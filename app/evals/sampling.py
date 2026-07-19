"""Deterministic corpus sampling for an eval run.

Sampling is by query. The sampled corpus is every gold document for the sampled
queries (always included, so no query is made unanswerable) plus a random pool of
distractor documents that controls corpus scale and difficulty. A fixed seed makes
the whole plan reproducible, and the corpus hash content-addresses the sampled
corpus so an eval collection can be reused across retrieval pipelines that share
the same ingestion pipeline.
"""

from __future__ import annotations

import hashlib
import random
from collections.abc import Mapping, Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class SamplePlan:
    """The resolved set of queries, gold docs, distractors, and corpus for a run."""

    query_ids: list[str]
    gold_doc_ids: list[str]
    distractor_doc_ids: list[str]
    corpus_doc_ids: list[str]
    corpus_hash: str


def build_sample_plan(
    *,
    query_ids: Sequence[str],
    qrels: Mapping[str, set[str]],
    corpus_doc_ids: Sequence[str],
    num_queries: int,
    distractor_pool_size: int,
    seed: int,
) -> SamplePlan:
    """Resolve the queries, gold docs, distractors, and corpus for one eval run.

    Inputs are sorted before sampling so the plan depends only on the content and
    the seed, not on iteration order. Gold documents absent from the corpus are
    dropped (they could never be retrieved).
    """
    rng = random.Random(seed)

    ordered_queries = sorted(query_ids)
    sample_count = min(num_queries, len(ordered_queries))
    sampled_queries = sorted(rng.sample(ordered_queries, sample_count))

    corpus_set = set(corpus_doc_ids)
    gold: set[str] = set()
    for query_id in sampled_queries:
        gold |= qrels.get(query_id, set()) & corpus_set

    non_gold = sorted(corpus_set - gold)
    distractor_count = min(distractor_pool_size, len(non_gold))
    distractors = sorted(rng.sample(non_gold, distractor_count))

    corpus = sorted(gold | set(distractors))
    corpus_hash = hashlib.sha256("\n".join(corpus).encode("utf-8")).hexdigest()[:16]

    return SamplePlan(
        query_ids=sampled_queries,
        gold_doc_ids=sorted(gold),
        distractor_doc_ids=distractors,
        corpus_doc_ids=corpus,
        corpus_hash=corpus_hash,
    )
