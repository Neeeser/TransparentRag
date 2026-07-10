"""First-run setup: derived readiness status and the one-shot bootstrap.

`status` derives readiness from real state (OpenRouter key, an index the
user can reach, a collection) so it can never drift from reality. `bootstrap`
applies the wizard's confirmed choices in one transaction: default ingestion
and retrieval pipelines built around the chosen model/index, the first
collection attached to them, and the global default embedding model seeded
if it is still unset.
"""

from __future__ import annotations

import logging
from contextlib import suppress
from uuid import uuid4

from sqlmodel import Session

from app.db import models
from app.db.repositories import AppSettingRepository, CollectionRepository
from app.pipelines.defaults import (
    build_default_ingestion_pipeline,
    build_default_retrieval_pipeline,
)
from app.pipelines.definition import PipelineDefinition
from app.schemas.enums import IndexBackend
from app.schemas.setup import SetupBootstrapRequest, SetupStatusRead
from app.services.app_config import get_app_config, invalidate_app_config_cache
from app.services.errors import (
    InvalidInputError,
    NotFoundError,
    ServiceError,
    is_external_provider_error,
)
from app.services.pipelines import PipelineService
from app.telemetry import record
from app.telemetry.events import CollectionCreated
from app.vectorstores.base import VectorIndexDescription
from app.vectorstores.registry import get_vector_store

logger = logging.getLogger(__name__)


class SetupService:
    """Derive first-run readiness and install the wizard's choices."""

    def __init__(self, session: Session) -> None:
        """Bind the service to a request-scoped session."""
        self.session = session
        self._collections = CollectionRepository(session)
        self._pipelines = PipelineService(session)

    def status(self, user: models.User) -> SetupStatusRead:
        """Return derived readiness for this user."""
        openrouter_configured = bool((user.openrouter_api_key or "").strip())
        has_index = self._has_index(user)
        has_collection = bool(self._collections.list_for_user(user.id))
        return SetupStatusRead(
            openrouter_configured=openrouter_configured,
            has_index=has_index,
            has_collection=has_collection,
            setup_complete=openrouter_configured and has_index and has_collection,
        )

    def bootstrap(self, user: models.User, payload: SetupBootstrapRequest) -> models.Collection:
        """Install default pipelines and the first collection in one commit."""
        self._validate_index(user, payload)
        defaults = self._install_default_pipelines(user, payload)
        collection = models.Collection(
            id=uuid4(),
            user_id=user.id,
            name=payload.collection_name,
            description=None,
            ingestion_pipeline_id=defaults[models.PipelineKind.INGESTION].id,
            retrieval_pipeline_id=defaults[models.PipelineKind.RETRIEVAL].id,
            extra_metadata={},
        )
        self._collections.add(collection)
        self._seed_default_embedding_model(payload.embedding_model, user)
        self.session.commit()
        self.session.refresh(collection)
        record(CollectionCreated(user_id=user.id, collection_id=collection.id))
        return collection

    def _has_index(self, user: models.User) -> bool:
        """True when any reachable backend holds at least one index.

        A backend whose provider is unreachable (or whose prerequisite is
        missing) counts as index-less rather than failing status -- readiness
        must always be answerable.
        """
        for backend in IndexBackend:
            try:
                store = get_vector_store(backend, user=user, session=self.session)
                if store.list_indexes():
                    return True
            except ServiceError:
                continue
            except Exception as exc:  # pylint: disable=broad-exception-caught
                if not is_external_provider_error(exc):
                    raise
                logger.warning("Skipping %s while deriving setup status: %s", backend, exc)
        return False

    def _validate_index(self, user: models.User, payload: SetupBootstrapRequest) -> None:
        """Ensure the chosen index exists and matches the model's dimension."""
        try:
            store = get_vector_store(payload.backend, user=user, session=self.session)
            description: VectorIndexDescription = store.describe_index(payload.index_name)
        except NotFoundError as exc:
            raise InvalidInputError(
                f"Index '{payload.index_name}' was not found on "
                f"{payload.backend.value}. Create it before finishing setup."
            ) from exc
        if (
            payload.embedding_dimension is not None
            and description.dimension is not None
            and description.dimension != payload.embedding_dimension
        ):
            raise InvalidInputError(
                f"Index '{payload.index_name}' has dimension "
                f"{description.dimension}, but '{payload.embedding_model}' "
                f"produces {payload.embedding_dimension}-dimension vectors."
            )

    def _install_default_pipelines(
        self, user: models.User, payload: SetupBootstrapRequest
    ) -> dict[models.PipelineKind, models.Pipeline]:
        """Create (or refresh) the default pipelines from the wizard's choices."""
        definitions: dict[models.PipelineKind, PipelineDefinition] = {
            models.PipelineKind.INGESTION: build_default_ingestion_pipeline(
                embedding_model=payload.embedding_model,
                backend=payload.backend,
                index_name=payload.index_name,
                chunk_size=payload.chunk_size,
                chunk_overlap=payload.chunk_overlap,
            ),
            models.PipelineKind.RETRIEVAL: build_default_retrieval_pipeline(
                embedding_model=payload.embedding_model,
                backend=payload.backend,
                index_name=payload.index_name,
            ),
        }
        installed: dict[models.PipelineKind, models.Pipeline] = {}
        for kind, definition in definitions.items():
            existing = next(
                (
                    pipeline
                    for pipeline in self._pipelines.list_pipelines(user.id, kind=kind)
                    if pipeline.is_default
                ),
                None,
            )
            if existing is None:
                label = "Ingestion" if kind == models.PipelineKind.INGESTION else "Retrieval"
                installed[kind] = self._pipelines.create_pipeline(
                    user=user,
                    name=f"Default {label} Pipeline",
                    description=f"Baseline {label.lower()} pipeline from first-run setup.",
                    kind=kind,
                    definition=definition,
                    change_summary="First-run setup.",
                    is_default=True,
                )
            else:
                # An identical definition raises "no changes" -- that is
                # already the desired end state, so suppress it.
                with suppress(InvalidInputError):
                    self._pipelines.update_pipeline(
                        pipeline=existing,
                        definition=definition,
                        change_summary="First-run setup re-applied.",
                        actor_id=user.id,
                    )
                installed[kind] = existing
        return installed

    def _seed_default_embedding_model(self, model: str, user: models.User) -> None:
        """Seed the global default model with the wizard's choice, once.

        Only when the effective value is still unset -- a later user's wizard
        never overwrites a default the deployment already settled on.
        """
        if get_app_config().models.default_embedding_model.strip():
            return
        AppSettingRepository(self.session).upsert(
            "models.default_embedding_model", model, updated_by=user.id
        )
        invalidate_app_config_cache()
