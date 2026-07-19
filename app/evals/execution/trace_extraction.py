"""Reduce recorded node-run summaries to per-node document lists for the funnel.

Item-producing nodes attach a complete ordered `ItemListTrace` to their summary
(`kind="items"`); chunk ids are `{document_id}:{order}`, so each node's item list
reduces to parent-document identities in rank order. Documents outside the
benchmark mapping (not part of the sampled corpus) are dropped. This module is
pure: the runner loads `PipelineNodeRun` rows and hands their summaries here.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Protocol

from app.evals.attribution.funnel import QueryNodeTrace


class NodeRunLike(Protocol):
    """The columns trace extraction needs off a `PipelineNodeRun` row."""

    node_id: str
    node_type: str
    node_name: str
    summary: dict[str, object]


def extract_node_traces(
    node_runs: Sequence[NodeRunLike] | Sequence[Mapping[str, object]],
    document_mapping: Mapping[str, str],
) -> list[QueryNodeTrace]:
    """Build one `QueryNodeTrace` per node run that recorded an item list.

    `document_mapping` maps Ragworks document UUIDs (as strings) to the
    benchmark's external document ids. The last `items`-kind output value per
    node wins — for nodes with several item ports, that is the final output list.
    """
    traces: list[QueryNodeTrace] = []
    for node_run in node_runs:
        fields = _fields(node_run)
        if fields is None:
            continue
        node_id, node_type, node_name, summary = fields
        item_ids = _last_item_list(summary)
        if item_ids is None:
            continue
        traces.append(
            QueryNodeTrace(
                node_id=node_id,
                node_type=node_type,
                label=node_name,
                document_ids=_to_document_ids(item_ids, document_mapping),
            )
        )
    return traces


def _fields(
    node_run: NodeRunLike | Mapping[str, object],
) -> tuple[str, str, str, Mapping[str, object]] | None:
    """Read the needed columns off a row object or a plain mapping."""
    if isinstance(node_run, Mapping):
        node_id = node_run.get("node_id")
        node_type = node_run.get("node_type")
        node_name = node_run.get("node_name")
        summary = node_run.get("summary")
    else:
        node_id = node_run.node_id
        node_type = node_run.node_type
        node_name = node_run.node_name
        summary = node_run.summary
    if (
        not isinstance(node_id, str)
        or not isinstance(node_type, str)
        or not isinstance(node_name, str)
        or not isinstance(summary, Mapping)
    ):
        return None
    return node_id, node_type, node_name, summary


def _last_item_list(summary: Mapping[str, object]) -> list[str] | None:
    """Return the chunk ids of the last `items`-kind output value, if any."""
    outputs = summary.get("outputs")
    if not isinstance(outputs, list):
        return None
    item_ids: list[str] | None = None
    for entry in outputs:
        if not isinstance(entry, Mapping) or entry.get("kind") != "items":
            continue
        value = entry.get("value")
        if not isinstance(value, Mapping):
            continue
        items = value.get("items")
        if not isinstance(items, list):
            continue
        ids = [
            item["id"]
            for item in items
            if isinstance(item, Mapping) and isinstance(item.get("id"), str)
        ]
        item_ids = ids
    return item_ids


def _to_document_ids(chunk_ids: list[str], mapping: Mapping[str, str]) -> list[str]:
    """Reduce chunk ids to external document ids, rank-ordered and deduplicated."""
    seen: set[str] = set()
    ordered: list[str] = []
    for chunk_id in chunk_ids:
        document_uuid = chunk_id.rsplit(":", 1)[0]
        external_id = mapping.get(document_uuid)
        if external_id is None or external_id in seen:
            continue
        seen.add(external_id)
        ordered.append(external_id)
    return ordered
