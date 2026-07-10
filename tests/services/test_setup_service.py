"""SetupService: first-run status derivation and one-shot bootstrap.

Status is derived from real state (key + index + collection), never a stored
flag. Bootstrap installs the wizard's default pipelines, creates the first
collection, and seeds the global default embedding model only when unset.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlmodel import Session, select

from app.db import models
from app.db.repositories import AppSettingRepository
from app.schemas.enums import IndexBackend
from app.schemas.indexes import IndexCreateRequest
from app.schemas.setup import SetupBootstrapRequest
from app.services.app_config import get_app_config, invalidate_app_config_cache
from app.services.errors import InvalidInputError
from app.services.index_admin import IndexAdminService
from app.services.setup import SetupService


@pytest.fixture(autouse=True)
def _invalidate_cache() -> Iterator[None]:
    invalidate_app_config_cache()
    yield
    invalidate_app_config_cache()


def _create_user(session: Session, *, openrouter_key: str | None = None) -> models.User:
    user = models.User(
        email="setup@example.com",
        full_name="Setup User",
        hashed_password="hashed",
        openrouter_api_key=openrouter_key,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_pgvector_index(session: Session, user: models.User, *, dimension: int = 384) -> None:
    IndexAdminService(session).create_index(
        user,
        IndexCreateRequest(
            name="first-index",
            backend=IndexBackend.PGVECTOR,
            dimension=dimension,
            metric="cosine",
        ),
    )


def _bootstrap_request(**overrides: object) -> SetupBootstrapRequest:
    payload: dict[str, object] = {
        "embedding_model": "sentence-transformers/all-minilm-l6-v2",
        "embedding_dimension": 384,
        "backend": "pgvector",
        "index_name": "first-index",
        "collection_name": "My first collection",
    }
    payload.update(overrides)
    return SetupBootstrapRequest.model_validate(payload)


def test_status_reports_missing_pieces(session: Session) -> None:
    user = _create_user(session)

    status = SetupService(session).status(user)

    assert status.openrouter_configured is False
    assert status.has_index is False
    assert status.has_collection is False
    assert status.setup_complete is False


def test_status_complete_when_key_index_and_collection_exist(
    pgvector_session: Session,
) -> None:
    session = pgvector_session
    user = _create_user(session, openrouter_key="or-key")
    _create_pgvector_index(session, user)
    session.add(
        models.Collection(user_id=user.id, name="c", description="", extra_metadata={})
    )
    session.commit()

    status = SetupService(session).status(user)

    assert status.openrouter_configured is True
    assert status.has_index is True
    assert status.has_collection is True
    assert status.setup_complete is True


def test_bootstrap_creates_default_pipelines_and_first_collection(
    pgvector_session: Session,
) -> None:
    session = pgvector_session
    user = _create_user(session, openrouter_key="or-key")
    _create_pgvector_index(session, user)

    collection = SetupService(session).bootstrap(user, _bootstrap_request())

    with Session(session.get_bind()) as fresh:
        pipelines = fresh.exec(select(models.Pipeline)).all()
        stored = fresh.get(models.Collection, collection.id)
        assert stored is not None
        assert stored.name == "My first collection"
        kinds = {pipeline.kind for pipeline in pipelines if pipeline.is_default}
        assert kinds == {models.PipelineKind.INGESTION, models.PipelineKind.RETRIEVAL}
        assert stored.ingestion_pipeline_id is not None
        assert stored.retrieval_pipeline_id is not None
        assert fresh.exec(select(models.PipelineVersion)).first() is not None


def test_bootstrap_writes_wizard_choices_into_pipelines(
    pgvector_session: Session,
) -> None:
    session = pgvector_session
    user = _create_user(session, openrouter_key="or-key")
    _create_pgvector_index(session, user)

    SetupService(session).bootstrap(user, _bootstrap_request(chunk_size=512))

    with Session(session.get_bind()) as fresh:
        versions = fresh.exec(select(models.PipelineVersion)).all()
    definitions = [version.definition for version in versions]
    embedders = [
        node
        for definition in definitions
        for node in definition["nodes"]
        if node["type"] == "embedder.openrouter"
    ]
    assert embedders
    assert all(
        node["config"]["model_name"] == "sentence-transformers/all-minilm-l6-v2"
        for node in embedders
    )
    chunkers = [
        node
        for definition in definitions
        for node in definition["nodes"]
        if node["id"] == "chunk-document"
    ]
    assert chunkers[0]["config"]["chunk_size"] == 512


def test_bootstrap_seeds_default_embedding_model_only_when_unset(
    pgvector_session: Session,
) -> None:
    session = pgvector_session
    user = _create_user(session, openrouter_key="or-key")
    _create_pgvector_index(session, user)
    AppSettingRepository(session).delete("models.default_embedding_model")
    session.commit()
    invalidate_app_config_cache()

    SetupService(session).bootstrap(user, _bootstrap_request())
    invalidate_app_config_cache()

    assert get_app_config().models.default_embedding_model == (
        "sentence-transformers/all-minilm-l6-v2"
    )


def test_bootstrap_keeps_existing_default_embedding_model(
    pgvector_session: Session,
) -> None:
    session = pgvector_session
    user = _create_user(session, openrouter_key="or-key")
    _create_pgvector_index(session, user)
    AppSettingRepository(session).upsert(
        "models.default_embedding_model", "existing/model", updated_by=None
    )
    session.commit()
    invalidate_app_config_cache()

    SetupService(session).bootstrap(user, _bootstrap_request())
    invalidate_app_config_cache()

    assert get_app_config().models.default_embedding_model == "existing/model"


def test_bootstrap_rejects_missing_index(session: Session) -> None:
    user = _create_user(session, openrouter_key="or-key")

    with pytest.raises(InvalidInputError):
        SetupService(session).bootstrap(user, _bootstrap_request())


def test_bootstrap_rejects_dimension_mismatch(pgvector_session: Session) -> None:
    session = pgvector_session
    user = _create_user(session, openrouter_key="or-key")
    _create_pgvector_index(session, user, dimension=768)

    with pytest.raises(InvalidInputError, match="dimension"):
        SetupService(session).bootstrap(user, _bootstrap_request(embedding_dimension=384))


def test_bootstrap_replaces_existing_default_pipelines(
    pgvector_session: Session,
) -> None:
    """A half-set-up user re-running the wizard updates defaults in place."""
    session = pgvector_session
    user = _create_user(session, openrouter_key="or-key")
    _create_pgvector_index(session, user)
    service = SetupService(session)
    service.bootstrap(user, _bootstrap_request())

    service.bootstrap(
        user,
        _bootstrap_request(embedding_model="another/model", collection_name="Second"),
    )

    with Session(session.get_bind()) as fresh:
        defaults = fresh.exec(
            select(models.Pipeline).where(models.Pipeline.is_default)  # type: ignore[arg-type]
        ).all()
    assert len(defaults) == 2
