"""The collection-deletion cascade, expressed as named purge steps.

Deleting a collection tears down three stores that don't share a transaction:
the Pinecone namespace (vectors), the file store (uploaded documents), and the
relational rows. Each is a named step so the sequence reads top-to-bottom and a
future change lands in exactly one place. Vector-purge failures are classified:
a missing namespace is benign (nothing to delete), any other Pinecone error is
surfaced as a 502 via `ExternalServiceError`.
"""

from __future__ import annotations

from sqlmodel import Session

from app.clients.pinecone import get_pinecone_client
from app.db import models
from app.db.repositories import CollectionRepository, DocumentRepository
from app.services.errors import ExternalServiceError, InvalidInputError
from app.services.pipeline_resolution import resolve_ingestion_pipeline
from app.telemetry import record
from app.telemetry.events import CollectionDeleted
from app.utils.file_storage import FileStorage


def _is_missing_pinecone_namespace(error: Exception) -> bool:
    """Return True when a Pinecone delete error means the namespace is absent."""
    message = str(error).lower()
    if "namespace not found" in message:
        return True
    status_code = getattr(error, "status_code", None) or getattr(error, "status", None)
    if status_code == 404 and "namespace" in message:
        return True
    response = getattr(error, "response", None)
    response_status = getattr(response, "status_code", None) if response else None
    return response_status == 404 and "namespace" in message


class CollectionDeletionService:
    """Delete a collection and every store that references it."""

    def __init__(self, session: Session) -> None:
        """Bind the service to a request-scoped session."""
        self.session = session
        self.collections = CollectionRepository(session)
        self.documents = DocumentRepository(session)
        self.storage = FileStorage()

    def delete(self, user: models.User, collection: models.Collection) -> None:
        """Purge vectors, files, and rows for a collection, then delete it."""
        resolved = resolve_ingestion_pipeline(self.session, user, collection)
        namespace = resolved.settings.namespace
        if not namespace:
            raise InvalidInputError("Ingestion pipeline namespace is not configured.")

        collection_id = collection.id
        self._purge_vectors(user, index_name=resolved.settings.index_name, namespace=namespace)
        self._purge_files(collection)
        self._purge_rows(collection)
        self.session.commit()
        record(CollectionDeleted(user_id=user.id, collection_id=collection_id))

    def _purge_vectors(self, user: models.User, *, index_name: str, namespace: str) -> None:
        """Delete the collection's Pinecone namespace, tolerating a missing one."""
        client = get_pinecone_client(api_key=user.pinecone_api_key or "")
        try:
            index = client.Index(index_name)
            index.delete(namespace=namespace, delete_all=True)
        except Exception as exc:  # pylint: disable=broad-exception-caught
            # Pinecone raises provider-specific error types; a missing namespace
            # is benign (nothing to purge), anything else is a real upstream fault.
            if not _is_missing_pinecone_namespace(exc):
                raise ExternalServiceError(
                    f"Failed to purge Pinecone namespace: {exc}"
                ) from exc

    def _purge_files(self, collection: models.Collection) -> None:
        """Remove every stored upload for the collection's documents."""
        for document in self.documents.list_for_collection(collection.id):
            self.storage.delete_path(document.source_path)

    def _purge_rows(self, collection: models.Collection) -> None:
        """Delete related rows, detach chat sessions, and delete the collection."""
        self.collections.purge_related_rows(collection.id)
        self.collections.delete(collection)
