"""The one place that resolves a collection's ingestion/retrieval pipeline.

Every caller that needs a collection's active pipeline definition and its
resolved settings follows the same sequence: ensure default pipelines exist
for the user, attach them to the collection if it has none assigned, load the
pipeline (validating its kind), and resolve its settings against the
collection. This module is the only place that sequence is written; callers
(ingestion, retrieval, and the collection routes that render prompts or purge
a collection's Pinecone namespace) all go through `resolve_ingestion_pipeline`
/ `resolve_retrieval_pipeline`.

Resolution failures raise `PipelineResolutionError`, never an HTTP exception --
this is a service module, so translating to a status code is the caller's job.
Routes translate it as a 400 (it is an `InvalidInputError`), including chat's
routes, which now catch `ServiceError` like every other service.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlmodel import Session

from app.db import models
from app.pipelines.definition import PipelineDefinition
from app.pipelines.registry import NodeRegistry, default_registry
from app.pipelines.settings import (
    IngestionPipelineSettings,
    RetrievalPipelineSettings,
    resolve_ingestion_settings,
    resolve_retrieval_settings,
)
from app.services.errors import InvalidInputError
from app.services.pipeline_validation import log_pipeline_validation_warnings
from app.services.pipelines import PipelineService


class PipelineResolutionError(InvalidInputError):
    """Raised when a collection's pipeline cannot be resolved.

    Subclasses `InvalidInputError` so routes map it to a 400 through the
    typed taxonomy. It used to also subclass `ValueError` as a transitional
    bridge for chat's not-yet-migrated `except ValueError` routes; that bridge
    is gone now that `routes/chat.py` catches `ServiceError` directly.
    """


@dataclass(frozen=True)
class ResolvedIngestionPipeline:
    """A collection's resolved ingestion pipeline, definition, and settings."""

    service: PipelineService
    pipeline: models.Pipeline
    definition: PipelineDefinition
    settings: IngestionPipelineSettings


@dataclass(frozen=True)
class ResolvedRetrievalPipeline:
    """A collection's resolved retrieval pipeline, definition, and settings."""

    service: PipelineService
    pipeline: models.Pipeline
    definition: PipelineDefinition
    settings: RetrievalPipelineSettings


def resolve_ingestion_pipeline(
    session: Session,
    user: models.User,
    collection: models.Collection,
    *,
    registry: NodeRegistry | None = None,
    scaffold: bool = True,
) -> ResolvedIngestionPipeline:
    """Resolve the collection's ingestion pipeline, definition, and settings.

    `scaffold=True` (default) runs ensure-defaults → attach, which *persists*
    default pipelines and binds them to the collection — correct for ingestion
    and retrieval, which are about to run a pipeline. `scaffold=False` is the
    read-only variant: it never mutates state (no GET endpoint may), so an
    unbound collection raises `PipelineResolutionError` instead of scaffolding
    and binding a default. Diagnostics uses `scaffold=False`.
    """
    service = PipelineService(session)
    if scaffold:
        defaults = service.ensure_default_pipelines(user)
        service.ensure_collection_pipelines(collection, defaults)
        pipeline_id = collection.ingestion_pipeline_id or defaults.ingestion.id
    elif collection.ingestion_pipeline_id is None:
        raise PipelineResolutionError("No ingestion pipeline is bound to this collection.")
    else:
        pipeline_id = collection.ingestion_pipeline_id
    pipeline = service.get_pipeline(pipeline_id, user.id)
    if not pipeline or pipeline.kind != models.PipelineKind.INGESTION:
        raise PipelineResolutionError("Ingestion pipeline could not be resolved.")
    definition = service.get_definition(pipeline)
    log_pipeline_validation_warnings(
        service.validate_definition(user, definition), context="ingestion execution"
    )
    settings = resolve_ingestion_settings(definition, collection, registry or default_registry())
    return ResolvedIngestionPipeline(
        service=service,
        pipeline=pipeline,
        definition=definition,
        settings=settings,
    )


def resolve_retrieval_pipeline(
    session: Session,
    user: models.User,
    collection: models.Collection,
    *,
    registry: NodeRegistry | None = None,
    scaffold: bool = True,
) -> ResolvedRetrievalPipeline:
    """Resolve the collection's retrieval pipeline, definition, and settings.

    See `resolve_ingestion_pipeline` for the `scaffold` contract: `False` is
    the read-only variant that never persists or binds a default pipeline.
    """
    service = PipelineService(session)
    if scaffold:
        defaults = service.ensure_default_pipelines(user)
        service.ensure_collection_pipelines(collection, defaults)
        pipeline_id = collection.retrieval_pipeline_id or defaults.retrieval.id
    elif collection.retrieval_pipeline_id is None:
        raise PipelineResolutionError("No retrieval pipeline is bound to this collection.")
    else:
        pipeline_id = collection.retrieval_pipeline_id
    pipeline = service.get_pipeline(pipeline_id, user.id)
    if not pipeline or pipeline.kind != models.PipelineKind.RETRIEVAL:
        raise PipelineResolutionError("Retrieval pipeline could not be resolved.")
    definition = service.get_definition(pipeline)
    log_pipeline_validation_warnings(
        service.validate_definition(user, definition), context="retrieval execution"
    )
    settings = resolve_retrieval_settings(definition, collection, registry or default_registry())
    return ResolvedRetrievalPipeline(
        service=service,
        pipeline=pipeline,
        definition=definition,
        settings=settings,
    )
