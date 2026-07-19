"""Behavior tests for extracting per-node document lists from node-run summaries.

The run engine feeds `build_funnel` from the `ItemListTrace` values recorded in
each `PipelineNodeRun.summary`; this pins the extraction: last items-kind output
per node wins, chunk ids reduce to parent document ids in rank order, and
document UUIDs map back to benchmark external ids (unknown ids are dropped).
"""

from __future__ import annotations

from app.evals.execution.trace_extraction import extract_node_traces

DOC_A = "0be3a4e6-0000-0000-0000-000000000001"
DOC_B = "0be3a4e6-0000-0000-0000-000000000002"

MAPPING = {DOC_A: "extA", DOC_B: "extB"}


def _summary(items: list[dict[str, object]], kind: str = "items") -> dict[str, object]:
    return {
        "inputs": [],
        "outputs": [
            {"label": "Matches", "value": {"count": len(items)}, "kind": "json"},
            {"label": "Match items", "value": {"kind": "matches", "items": items}, "kind": kind},
        ],
    }


def test_extracts_document_ids_in_rank_order_deduplicated() -> None:
    """Chunk ids reduce to parent documents, first occurrence wins."""
    node_runs = [
        {
            "node_id": "R1",
            "node_type": "retriever.vector",
            "node_name": "Dense",
            "summary": _summary(
                [
                    {"id": f"{DOC_A}:2", "score": 0.9},
                    {"id": f"{DOC_A}:0", "score": 0.8},
                    {"id": f"{DOC_B}:1", "score": 0.7},
                ]
            ),
        }
    ]
    traces = extract_node_traces(node_runs, MAPPING)
    assert len(traces) == 1
    assert traces[0].node_id == "R1"
    assert traces[0].label == "Dense"
    assert traces[0].document_ids == ["extA", "extB"]


def test_nodes_without_item_lists_are_skipped() -> None:
    """A node whose summary has no items-kind output contributes no trace."""
    node_runs = [
        {
            "node_id": "E1",
            "node_type": "embedder.text",
            "node_name": "Embedder",
            "summary": {"inputs": [], "outputs": [{"label": "x", "value": {}, "kind": "json"}]},
        }
    ]
    assert extract_node_traces(node_runs, MAPPING) == []


def test_unknown_document_ids_are_dropped() -> None:
    """A chunk whose document is not in the mapping (not benchmark-owned) is dropped."""
    node_runs = [
        {
            "node_id": "R1",
            "node_type": "retriever.vector",
            "node_name": "Dense",
            "summary": _summary([{"id": "ffffffff-0000-0000-0000-00000000000f:0", "score": 0.5}]),
        }
    ]
    traces = extract_node_traces(node_runs, MAPPING)
    assert traces[0].document_ids == []


def test_malformed_summaries_are_tolerated() -> None:
    """A summary that is not the expected shape yields no trace, never a crash."""
    node_runs = [
        {"node_id": "X", "node_type": "t", "node_name": "n", "summary": {}},
        {"node_id": "Y", "node_type": "t", "node_name": "n", "summary": {"outputs": "bad"}},
    ]
    assert extract_node_traces(node_runs, MAPPING) == []
