"""Startup migrations for stored pipeline definitions."""

from sqlmodel import Session

from app.db.repositories import (
    PipelineRepository,
    PipelineVersionRepository,
    UserRepository,
)
from app.pipelines.definition import PipelineDefinition
from app.pipelines.upgrades import upgrade_definition
from app.services.pipeline_validation import (
    log_pipeline_validation_warnings,
    validate_pipeline_definition,
)


def upgrade_stored_pipeline_definitions(session: Session) -> int:
    """Rewrite stored pipeline versions to the current node vocabulary."""
    versions = PipelineVersionRepository(session)
    pipelines = PipelineRepository(session)
    users = UserRepository(session)
    upgraded_count = 0
    for version in versions.list_all():
        definition = PipelineDefinition.model_validate(version.definition)
        upgraded = upgrade_definition(definition)
        if upgraded is None:
            continue
        version.definition = upgraded.model_dump(mode="json")
        session.add(version)
        pipeline = pipelines.get(version.pipeline_id)
        user = users.get(pipeline.user_id) if pipeline is not None else None
        if user is not None:
            result = validate_pipeline_definition(session, user, upgraded)
            log_pipeline_validation_warnings(result, context="stored-definition upgrade")
        upgraded_count += 1
    return upgraded_count
