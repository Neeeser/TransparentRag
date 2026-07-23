# pylint: disable=duplicate-code
"""Pipeline services for managing definitions, versions, and defaults."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlmodel import Session

from app.core.config import get_settings
from app.db import models
from app.db.repositories import (
    CollectionPipelineBindingRepository,
    CollectionRepository,
    PipelineRepository,
    PipelineVersionRepository,
    UserRepository,
)
from app.pipelines.defaults import (
    build_default_ingestion_pipeline,
    build_default_retrieval_pipeline,
)
from app.pipelines.definition import PipelineDefinition
from app.pipelines.diff import DefinitionChange, diff_definitions, material_changes
from app.pipelines.interface import PipelineInterface, derive_interface
from app.pipelines.nodes.chunking import BaseChunkerNode, FixedChunkerConfig
from app.pipelines.nodes.embedding import EmbedderConfig, EmbedderNode
from app.pipelines.registry import default_registry
from app.pipelines.resolution import resolve_static_definition
from app.pipelines.settings import resolve_definition_backend
from app.pipelines.validation import PipelineValidationResult
from app.schemas.enums import IndexBackend, PipelineKind
from app.services.app_config import get_app_config
from app.services.errors import InvalidInputError, NotFoundError
from app.services.huggingface_tokenizers import HuggingFaceTokenizerService
from app.services.pipeline_upgrades import (
    upgrade_stored_pipeline_definitions as upgrade_stored_pipeline_definitions,
)
from app.services.pipeline_validation import (
    EmbeddingInputLimitResolver,
    validate_pipeline_definition,
)

#: Template slugs marking a user's scaffolded default pipelines.
DEFAULT_INGEST_SLUG = "default-ingest"
DEFAULT_SEARCH_SLUG = "default-search"


@dataclass
class DefaultPipelines:
    """Container for a user's default ingest and search pipelines."""

    ingestion: models.Pipeline
    retrieval: models.Pipeline


def derived_kind(interface: PipelineInterface) -> PipelineKind | None:
    """Map a derived interface onto the wire's UI-grouping kind.

    Document-accepting graphs group as ingestion; callable graphs as
    retrieval. A graph that is neither has no kind — it shows ungrouped.
    """
    if interface.accepts_document:
        return PipelineKind.INGESTION
    if interface.callable:
        return PipelineKind.RETRIEVAL
    return None


class PipelineService:
    """Service for pipeline CRUD and version management."""

    def __init__(
        self,
        session: Session,
        *,
        embedding_input_limit: EmbeddingInputLimitResolver | None = None,
    ) -> None:
        """Initialize with an optional provider-limit override for focused tests."""
        self.session = session
        self._pipelines = PipelineRepository(session)
        self._versions = PipelineVersionRepository(session)
        self._collections = CollectionRepository(session)
        self._bindings = CollectionPipelineBindingRepository(session)
        self._users = UserRepository(session)
        self._embedding_input_limit = embedding_input_limit

    def validate_definition(
        self,
        user: models.User,
        definition: PipelineDefinition,
    ) -> PipelineValidationResult:
        """Validate a definition using its selected provider connections."""
        return validate_pipeline_definition(
            self.session,
            user,
            definition,
            embedding_input_limit=self._embedding_input_limit,
        )

    def _validate_before_persisting(
        self,
        user: models.User,
        definition: PipelineDefinition,
    ) -> None:
        """Reject invalid definitions with field-addressable issue metadata."""
        result = self.validate_definition(user, definition)
        if result.valid:
            self._ensure_huggingface_tokenizers(user, definition)
            return
        raise InvalidInputError(
            {
                "errors": result.errors,
                "issues": [
                    issue.model_dump(exclude_none=True)
                    for issue in result.issues
                    if issue.severity == "error"
                ],
            }
        )

    def _ensure_huggingface_tokenizers(
        self,
        user: models.User,
        definition: PipelineDefinition,
    ) -> None:
        """Resolve HF tokenizer caches before a definition is persisted."""
        service = HuggingFaceTokenizerService(self.session, get_settings().storage_path)
        for node in resolve_static_definition(definition).nodes:
            node_cls = default_registry().get_node_class(node.type)
            if node_cls is None or not issubclass(node_cls, BaseChunkerNode):
                continue
            config = FixedChunkerConfig.model_validate(node.config or {})
            if config.tokenizer == "huggingface" and config.hf_model_id:
                service.ensure_available(user, config.hf_model_id)

    def list_pipelines(
        self,
        user_id: UUID,
        *,
        kind: PipelineKind | None = None,
    ) -> list[models.Pipeline]:
        """Return pipelines for the given user, optionally filtered by derived kind."""
        pipelines = self._pipelines.list_for_user(user_id)
        if kind is None:
            return pipelines
        return [
            pipeline
            for pipeline in pipelines
            if derived_kind(self.interface_for(pipeline)) is kind
        ]

    def get_pipeline(self, pipeline_id: UUID, user_id: UUID) -> models.Pipeline | None:
        """Return a pipeline for a user."""
        return self._pipelines.get(pipeline_id, user_id=user_id)

    def get_current_version(self, pipeline: models.Pipeline) -> models.PipelineVersion:
        """Return the current version for a pipeline."""
        version = self._versions.get_by_version(pipeline.id, pipeline.current_version)
        if not version:
            raise ValueError("Pipeline has no current version.")
        return version

    def get_definition(self, pipeline: models.Pipeline) -> PipelineDefinition:
        """Return the current definition for a pipeline."""
        version = self.get_current_version(pipeline)
        return PipelineDefinition.model_validate(version.definition)

    def interface_for(self, pipeline: models.Pipeline) -> PipelineInterface:
        """Return the current version's derived interface."""
        return self.interface_for_version(self.get_current_version(pipeline))

    @staticmethod
    def interface_for_version(version: models.PipelineVersion) -> PipelineInterface:
        """Return a version's interface: the materialized copy, or re-derived.

        Versions saved before the column existed carry NULL; deriving in
        memory (never writing — reads must not mutate) keeps them serving.
        """
        if version.interface is not None:
            return PipelineInterface.model_validate(version.interface)
        return derive_interface(PipelineDefinition.model_validate(version.definition))

    def create_pipeline(  # pylint: disable=too-many-arguments
        self,
        *,
        user: models.User,
        name: str,
        definition: PipelineDefinition,
        description: str | None = None,
        change_summary: str | None = None,
        template_slug: str | None = None,
    ) -> models.Pipeline:
        """Create a pipeline and its first version (interface materialized)."""
        self._validate_before_persisting(user, definition)
        pipeline = models.Pipeline(
            user_id=user.id,
            name=name,
            description=description,
            current_version=1,
            template_slug=template_slug,
        )
        self._pipelines.add(pipeline)
        version = models.PipelineVersion(
            pipeline_id=pipeline.id,
            version=1,
            definition=definition.model_dump(mode="json"),
            interface=derive_interface(definition).model_dump(mode="json"),
            change_summary=change_summary,
            created_by=user.id,
        )
        self._versions.add(version)
        return pipeline

    def update_pipeline(  # pylint: disable=too-many-arguments
        self,
        *,
        pipeline: models.Pipeline,
        definition: PipelineDefinition | None = None,
        name: str | None = None,
        description: str | None = None,
        change_summary: str | None = None,
        actor_id: UUID | None = None,
    ) -> models.Pipeline:
        """Update pipeline metadata and optionally create a new version.

        A definition identical to the current version is rejected (saving
        should never mint an empty revision), and a definition whose only
        difference is layout (node positions) updates the current version in
        place instead of creating a new one -- dragging nodes around is not a
        revision of what the pipeline does.
        """
        metadata_changed = name is not None or description is not None
        if definition is not None:
            owner = self._users.get(pipeline.user_id)
            if owner is None:
                raise NotFoundError("Pipeline owner does not exist.")
            self._validate_before_persisting(owner, definition)
        if name is not None:
            pipeline.name = name
        if description is not None:
            pipeline.description = description
        if definition is not None:
            current_row = self.get_current_version(pipeline)
            current = PipelineDefinition.model_validate(current_row.definition)
            changes = diff_definitions(current, definition)
            if not changes and not metadata_changed:
                raise InvalidInputError(
                    "No changes to save — the pipeline already matches this definition."
                )
            if material_changes(changes):
                next_version = pipeline.current_version + 1
                version = models.PipelineVersion(
                    pipeline_id=pipeline.id,
                    version=next_version,
                    definition=definition.model_dump(mode="json"),
                    interface=derive_interface(definition).model_dump(mode="json"),
                    change_summary=change_summary,
                    created_by=actor_id,
                )
                self._versions.add(version)
                pipeline.current_version = next_version
            elif changes:
                current_row.definition = definition.model_dump(mode="json")
                current_row.interface = derive_interface(definition).model_dump(mode="json")
                self.session.add(current_row)
        self.session.add(pipeline)
        return pipeline

    def list_versions(self, pipeline: models.Pipeline) -> list[models.PipelineVersion]:
        """List versions for a pipeline."""
        return self._versions.list_for_pipeline(pipeline.id)

    def list_versions_with_changes(
        self,
        pipeline: models.Pipeline,
    ) -> list[tuple[models.PipelineVersion, list[DefinitionChange]]]:
        """List versions newest-first, each with its diff against the prior version."""
        versions = self._versions.list_for_pipeline(pipeline.id)
        by_number = {version.version: version for version in versions}
        result: list[tuple[models.PipelineVersion, list[DefinitionChange]]] = []
        for version in versions:
            previous = by_number.get(version.version - 1)
            if previous is None:
                changes = [DefinitionChange(kind="created", summary="Initial version")]
            else:
                changes = diff_definitions(
                    PipelineDefinition.model_validate(previous.definition),
                    PipelineDefinition.model_validate(version.definition),
                )
            result.append((version, changes))
        return result

    def pipeline_in_use(self, pipeline_id: UUID) -> bool:
        """Return True if any collection binds the pipeline."""
        return self._collections.references_pipeline(pipeline_id)

    def delete_pipeline(self, pipeline: models.Pipeline) -> None:
        """Delete a pipeline and its versions."""
        self._versions.delete_for_pipeline(pipeline.id)
        self.session.delete(pipeline)
        self.session.flush()

    def activate_version(self, pipeline: models.Pipeline, version: int) -> models.Pipeline:
        """Set the pipeline's active version."""
        target = self._versions.get_by_version(pipeline.id, version)
        if not target:
            raise NotFoundError("Requested pipeline version does not exist.")
        pipeline.current_version = version
        self.session.add(pipeline)
        return pipeline

    def ensure_default_pipelines(self, user: models.User) -> DefaultPipelines:
        """Ensure default ingest/search pipelines on the configured backend.

        A stored default whose vector-store backend no longer matches the
        deployment's `indexing.default_backend` is demoted (kept, renamed with
        its backend, still bound by existing collections) and a fresh default
        is re-scaffolded around the demoted pipeline's own embedder — so new
        collections always index into the configured backend while old
        collections keep their data. There are no global default models: a
        user with no defaults at all (first-run setup never completed) raises
        `InvalidInputError` pointing at the wizard, which scaffolds with an
        explicit embedding choice.
        """
        configured = IndexBackend(get_app_config().indexing.default_backend)
        stored_ingestion = self._pipelines.get_by_template_slug(user.id, DEFAULT_INGEST_SLUG)
        stored_retrieval = self._pipelines.get_by_template_slug(user.id, DEFAULT_SEARCH_SLUG)
        ingestion = self._demote_if_backend_stale(stored_ingestion, configured)
        retrieval = self._demote_if_backend_stale(stored_retrieval, configured)

        if ingestion is None:
            embedding = self._embedding_selection_from(stored_ingestion or stored_retrieval)
            ingestion = self.create_pipeline(
                user=user,
                name="Default Ingestion Pipeline",
                description="Baseline ingestion pipeline for uploads.",
                definition=build_default_ingestion_pipeline(
                    embedding_connection_id=embedding[0],
                    embedding_model=embedding[1],
                ),
                change_summary="Initial default ingestion pipeline.",
                template_slug=DEFAULT_INGEST_SLUG,
            )
        if retrieval is None:
            embedding = self._embedding_selection_from(
                stored_retrieval or stored_ingestion or ingestion
            )
            retrieval = self.create_pipeline(
                user=user,
                name="Default Retrieval Pipeline",
                description="Baseline retrieval pipeline for queries.",
                definition=build_default_retrieval_pipeline(
                    embedding_connection_id=embedding[0],
                    embedding_model=embedding[1],
                ),
                change_summary="Initial default retrieval pipeline.",
                template_slug=DEFAULT_SEARCH_SLUG,
            )
        return DefaultPipelines(ingestion=ingestion, retrieval=retrieval)

    def _embedding_selection_from(
        self, pipeline: models.Pipeline | None
    ) -> tuple[UUID, str]:
        """Read `(connection_id, model)` off an existing pipeline's embedder.

        Scaffolding a default needs an embedding choice, and with global
        default models removed the only legitimate source outside the setup
        wizard is an existing pipeline (e.g. the default demoted for a
        backend change).
        """
        if pipeline is not None:
            version = self.get_current_version(pipeline)
            stored = PipelineDefinition.model_validate(version.definition)
            definition = resolve_static_definition(stored)
            for node in definition.nodes:
                if node.type != EmbedderNode.type:
                    continue
                config = EmbedderConfig.model_validate(node.config or {})
                if config.connection_id and config.model_name:
                    return config.connection_id, config.model_name
        raise InvalidInputError(
            "No default pipelines exist yet. Complete the first-time setup "
            "wizard (or create a collection with an explicit embedding model) "
            "before this operation."
        )

    def _demote_if_backend_stale(
        self,
        pipeline: models.Pipeline | None,
        configured: IndexBackend,
    ) -> models.Pipeline | None:
        """Demote a default pipeline whose backend no longer matches config."""
        if pipeline is None:
            return None
        version = self.get_current_version(pipeline)
        definition = PipelineDefinition.model_validate(version.definition)
        backend = resolve_definition_backend(definition, default_registry())
        if backend is configured:
            return pipeline
        pipeline.template_slug = None
        pipeline.name = f"{pipeline.name} ({backend.value})"
        self.session.add(pipeline)
        return None

    def ensure_collection_bindings(
        self,
        collection: models.Collection,
        defaults: DefaultPipelines,
    ) -> models.Collection:
        """Bind default pipelines to a collection missing ingest/tool bindings."""
        existing = self._bindings.list_for_collection(collection.id)
        has_ingest = any(
            binding.role == models.BindingRole.INGEST for binding in existing
        )
        tools = [binding for binding in existing if binding.role == models.BindingRole.TOOL]
        if not has_ingest:
            self._bindings.add(
                models.CollectionPipelineBinding(
                    collection_id=collection.id,
                    pipeline_id=defaults.ingestion.id,
                    role=models.BindingRole.INGEST,
                )
            )
        if not tools:
            self._bindings.add(
                models.CollectionPipelineBinding(
                    collection_id=collection.id,
                    pipeline_id=defaults.retrieval.id,
                    role=models.BindingRole.TOOL,
                    is_primary=True,
                )
            )
        return collection


def backfill_default_pipelines(session: Session) -> None:
    """Ensure all users and collections have default pipelines bound.

    A user with no defaults on an install with no configured embedding model
    is skipped, not failed: they haven't completed first-run setup yet, and
    the wizard scaffolds their defaults with an explicit model when they do.
    """
    service = PipelineService(session)
    collection_repo = CollectionRepository(session)
    for user in UserRepository(session).list_all():
        try:
            defaults = service.ensure_default_pipelines(user)
        except InvalidInputError:
            continue
        for collection in collection_repo.list_for_user(user.id):
            service.ensure_collection_bindings(collection, defaults)
