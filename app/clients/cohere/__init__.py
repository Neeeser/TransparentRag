"""Typed client for Cohere's catalog, chat, embedding, and reranking APIs."""

from app.clients.cohere.client import (
    CohereClient,
    close_cohere_clients,
    get_cohere_client,
    invalidate_cohere_client,
)
from app.clients.cohere.schemas import (
    CohereChatResponse,
    CohereEmbedResponse,
    CohereModel,
    CohereRerankResponse,
    CohereStreamEvent,
)

__all__ = [
    "CohereChatResponse",
    "CohereClient",
    "CohereEmbedResponse",
    "CohereModel",
    "CohereRerankResponse",
    "CohereStreamEvent",
    "close_cohere_clients",
    "get_cohere_client",
    "invalidate_cohere_client",
]
