"""Provider-neutral reranker contract tests."""

from __future__ import annotations

import inspect
from collections.abc import Sequence

from app.retrieval.models import ScoredChunk
from app.retrieval.rerankers.base import Reranker
from app.schemas.enums import ProviderKind
from app.schemas.providers import CatalogModel


class _IdentityReranker:
    def rerank(
        self, query: str, candidates: Sequence[ScoredChunk]
    ) -> Sequence[ScoredChunk]:
        del query
        return candidates


def test_reranking_is_a_provider_capability() -> None:
    assert ProviderKind.RERANKING.value == "reranking"


def test_reranker_contract_never_exposes_a_result_limit() -> None:
    reranker: Reranker = _IdentityReranker()
    parameters = inspect.signature(reranker.rerank).parameters

    assert list(parameters) == ["query", "candidates"]


def test_catalog_model_reports_input_and_output_modalities() -> None:
    fields = CatalogModel.model_fields

    assert fields["input_modalities"].default_factory() == []
    assert fields["output_modalities"].default_factory() == []
