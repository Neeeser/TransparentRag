"""Fixtures for the diagnostics rule/service tests."""

from __future__ import annotations

import pytest

from app.pipelines.settings import IngestionPipelineSettings, RetrievalPipelineSettings
from tests.services.diagnostics.helpers import (
    base_ingestion_settings,
    base_retrieval_settings,
)


@pytest.fixture(name="base_ingestion")
def base_ingestion_fixture() -> IngestionPipelineSettings:
    """Resolved default ingestion settings tests tweak with `replace`."""
    return base_ingestion_settings()


@pytest.fixture(name="base_retrieval")
def base_retrieval_fixture() -> RetrievalPipelineSettings:
    """Resolved default retrieval settings tests tweak with `replace`."""
    return base_retrieval_settings()
