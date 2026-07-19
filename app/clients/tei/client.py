"""Typed HTTP client for Hugging Face Text Embeddings Inference (TEI)."""

from __future__ import annotations

from collections.abc import Iterable

import httpx
from pydantic import TypeAdapter

from app.cache import CachePolicy, ResourceCache, ValueCache
from app.clients.tei.schemas import TEIInfo, TEIRerankResult

_embedding_vectors = TypeAdapter(list[list[float]])
_rerank_results = TypeAdapter(list[TEIRerankResult])

# `/info` is read on every connections listing, coverage check, and catalog
# request; without a process-wide TTL cache each of those becomes a live probe
# of the TEI server (5s connect timeout per row when it is down).
_INFO_POLICY = CachePolicy(
    fresh_seconds=30,
    max_stale_seconds=300,
    failure_retry_seconds=15,
    max_entries=1,
)


class TEIClient:
    """HTTP client bound to one TEI server and its optional proxy credential."""

    def __init__(self, base_url: str, api_key: str | None = None) -> None:
        """Initialize TEI transport, normalizing a server URL once."""
        resolved_url = (base_url or "").strip().rstrip("/")
        if not resolved_url:
            raise ValueError("TEI base URL must be provided.")
        headers: dict[str, str] = {}
        resolved_key = (api_key or "").strip()
        if resolved_key:
            headers["Authorization"] = f"Bearer {resolved_key}"
        self._http = httpx.Client(
            base_url=resolved_url,
            headers=headers,
            timeout=httpx.Timeout(60.0, connect=5.0),
        )
        self._info = ValueCache[str, TEIInfo](_INFO_POLICY, refresh_workers=1)

    def _fetch_info(self) -> TEIInfo:
        """Fetch the served model's task and input-limit metadata."""
        response = self._http.get("/info")
        response.raise_for_status()
        return TEIInfo.model_validate(response.json())

    def info(self, *, force_refresh: bool = False) -> TEIInfo:
        """Return the served model's metadata through the process-wide TTL cache."""
        return self._info.get("info", self._fetch_info, force_refresh=force_refresh).value

    def ensure_serves(self, model_name: str) -> None:
        """Reject inference against a server whose served model has changed.

        A TEI container restarted with a different ``--model-id`` would
        otherwise silently embed or score with the wrong model; the cached
        `/info` read keeps this check off the network for fresh entries.
        """
        served = self.info().model_id
        if served != model_name:
            raise ValueError(
                f"The TEI server now serves '{served}', not '{model_name}'. "
                "Update the connection's model selection."
            )

    def embed(self, texts: Iterable[str]) -> list[list[float]]:
        """Embed text inputs through TEI's native ``POST /embed`` endpoint."""
        response = self._http.post("/embed", json={"inputs": list(texts)})
        response.raise_for_status()
        return _embedding_vectors.validate_python(response.json())

    def rerank(self, query: str, texts: Iterable[str]) -> list[TEIRerankResult]:
        """Score text inputs against a query through TEI's native rerank endpoint."""
        response = self._http.post("/rerank", json={"query": query, "texts": list(texts)})
        response.raise_for_status()
        return _rerank_results.validate_python(response.json())

    def close(self) -> None:
        """Close the owned HTTP connection pool and info-cache workers."""
        self._info.close()
        self._http.close()


TEIClientKey = tuple[str, str]


def _client_key(base_url: str, api_key: str | None) -> TEIClientKey:
    return (base_url.strip().rstrip("/"), (api_key or "").strip())


_client_cache: ResourceCache[TEIClientKey, TEIClient] = ResourceCache(
    max_entries=64, key_material=lambda key: "\n".join(key)
)


def get_tei_client(base_url: str, api_key: str | None = None) -> TEIClient:
    """Return the cached client for a TEI server configuration."""
    return _client_cache.get_or_create(
        _client_key(base_url, api_key), lambda: TEIClient(base_url, api_key)
    )


def invalidate_tei_client(base_url: str, api_key: str | None = None) -> bool:
    """Close a cached TEI client after its connection changes."""
    return _client_cache.invalidate(_client_key(base_url, api_key))


def close_tei_clients() -> None:
    """Close all cached TEI clients during application shutdown."""
    _client_cache.close_all()
