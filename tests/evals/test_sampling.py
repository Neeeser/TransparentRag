"""Behavior tests for eval-run corpus sampling.

The load-bearing invariant: every gold document for a sampled query is always in
the sampled corpus (so no sampled query is made unanswerable), and sampling is
deterministic under a fixed seed (so runs are reproducible and comparable).
"""

from __future__ import annotations

from app.evals.sampling import build_sample_plan

QUERIES = ["q1", "q2", "q3", "q4"]
QRELS = {
    "q1": {"d1", "d2"},
    "q2": {"d2", "d3"},
    "q3": {"d4"},
    "q4": {"d99"},  # gold doc missing from the corpus
}
CORPUS = ["d1", "d2", "d3", "d4", "d5", "d6", "d7"]


def _plan(num_queries: int = 4, distractors: int = 2, seed: int = 0):
    return build_sample_plan(
        query_ids=QUERIES,
        qrels=QRELS,
        corpus_doc_ids=CORPUS,
        num_queries=num_queries,
        distractor_pool_size=distractors,
        seed=seed,
    )


def test_sampling_is_deterministic_under_a_fixed_seed() -> None:
    """Two builds with the same inputs and seed are identical."""
    assert _plan(num_queries=2, seed=7) == _plan(num_queries=2, seed=7)


def test_gold_docs_are_always_in_the_corpus() -> None:
    """Every gold doc for a sampled query appears in the sampled corpus."""
    plan = _plan(num_queries=2, distractors=1, seed=3)
    corpus = set(plan.corpus_doc_ids)
    for query_id in plan.query_ids:
        for gold_doc in QRELS[query_id] & set(CORPUS):
            assert gold_doc in corpus


def test_gold_docs_missing_from_corpus_are_excluded() -> None:
    """A qrel pointing at a doc not in the corpus never enters the gold set."""
    plan = _plan(num_queries=4)  # includes q4, whose only gold doc is d99
    assert "d99" not in plan.gold_doc_ids
    assert plan.gold_doc_ids == ["d1", "d2", "d3", "d4"]


def test_distractors_exclude_gold_and_respect_the_pool_size() -> None:
    """Distractors are drawn only from non-gold docs, capped at the pool size."""
    plan = _plan(num_queries=4, distractors=2)
    gold = set(plan.gold_doc_ids)
    assert len(plan.distractor_doc_ids) == 2
    assert all(doc_id not in gold for doc_id in plan.distractor_doc_ids)


def test_distractor_pool_is_capped_at_available_non_gold_docs() -> None:
    """Asking for more distractors than exist yields every non-gold doc."""
    plan = _plan(num_queries=4, distractors=100)
    assert set(plan.distractor_doc_ids) == {"d5", "d6", "d7"}


def test_query_count_is_capped_at_available_queries() -> None:
    """Asking for more queries than exist samples all of them."""
    plan = _plan(num_queries=99)
    assert len(plan.query_ids) == 4


def test_corpus_is_the_union_of_gold_and_distractors() -> None:
    """The sampled corpus is exactly gold plus distractors, deduplicated."""
    plan = _plan(num_queries=4, distractors=2)
    assert set(plan.corpus_doc_ids) == set(plan.gold_doc_ids) | set(plan.distractor_doc_ids)


def test_corpus_hash_is_stable_and_content_addressed() -> None:
    """The corpus hash is stable for identical corpora and changes when it changes."""
    same_a = _plan(num_queries=4, distractors=0)
    same_b = _plan(num_queries=4, distractors=0)
    different = _plan(num_queries=4, distractors=3)
    assert same_a.corpus_hash == same_b.corpus_hash
    assert same_a.corpus_hash != different.corpus_hash
