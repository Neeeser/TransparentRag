from __future__ import annotations

import pytest

from app.schemas.pinecone_indexes import PineconeIndexCreateRequest


def test_create_request_requires_dimension_for_dense() -> None:
    with pytest.raises(ValueError, match="Dense indexes require a dimension"):
        PineconeIndexCreateRequest(name="alpha", vector_type="dense", dimension=None)


def test_create_request_rejects_dimension_for_sparse() -> None:
    with pytest.raises(ValueError, match="Sparse indexes must not define a dimension"):
        PineconeIndexCreateRequest(name="alpha", vector_type="sparse", dimension=256)
