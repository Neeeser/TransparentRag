from __future__ import annotations

from sqlmodel import Session, select

from app.db import models
from app.pipelines.defaults import build_default_ingestion_pipeline
from app.services.pipelines import PipelineService


def _create_user(session: Session) -> models.User:
    user = models.User(email="pipeline@example.com", full_name="Pipeline User", hashed_password="hashed")
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def test_ensure_default_pipelines_creates_versions(session: Session) -> None:
    user = _create_user(session)
    service = PipelineService(session)

    defaults = service.ensure_default_pipelines(user)
    session.commit()

    pipelines = session.exec(select(models.Pipeline)).all()
    versions = session.exec(select(models.PipelineVersion)).all()

    assert defaults.ingestion.is_default
    assert defaults.retrieval.is_default
    assert len(pipelines) == 2
    assert len(versions) == 2


def test_update_pipeline_creates_new_version(session: Session) -> None:
    user = _create_user(session)
    service = PipelineService(session)
    defaults = service.ensure_default_pipelines(user)
    session.commit()

    pipeline = defaults.ingestion
    service.update_pipeline(
        pipeline=pipeline,
        definition=build_default_ingestion_pipeline(),
        change_summary="Second revision",
        actor_id=user.id,
    )
    session.commit()

    updated = session.get(models.Pipeline, pipeline.id)
    versions = session.exec(
        select(models.PipelineVersion).where(models.PipelineVersion.pipeline_id == pipeline.id)
    ).all()

    assert updated is not None
    assert updated.current_version == 2
    assert len(versions) == 2


def test_activate_version_switches_current(session: Session) -> None:
    user = _create_user(session)
    service = PipelineService(session)
    defaults = service.ensure_default_pipelines(user)
    session.commit()

    pipeline = defaults.ingestion
    service.update_pipeline(
        pipeline=pipeline,
        definition=build_default_ingestion_pipeline(),
        change_summary="Second revision",
        actor_id=user.id,
    )
    service.activate_version(pipeline, 1)
    session.commit()

    updated = session.get(models.Pipeline, pipeline.id)
    assert updated is not None
    assert updated.current_version == 1
