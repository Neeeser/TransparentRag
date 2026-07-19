"""The eval run engine: provision, evaluate every query, aggregate, attribute.

`run_eval` is the background-task entry point (own `session_scope`, never
re-raises — the run row records the outcome). Each query runs through the real
retrieval path (`RetrievalService.query_collection`), its `EvalRunItem` is
persisted the moment it completes (live progress, restart resilience), and
cancellation is checked cooperatively between queries. On completion the runner
aggregates metrics, builds the node-addressed recall funnel from the recorded
traces, and stores both on the run row.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlmodel import Session, col, select

from app.db import models
from app.db.engine import session_scope
from app.db.repositories import EvalDatasetRepository, EvalRunRepository
from app.evals.attribution.funnel import QueryFunnelInput, build_funnel
from app.evals.execution.scoring import aggregate_metrics_mean, failed_item, score_query
from app.evals.provisioning import EvalProvisioner, ProvisionResult, ProvisionSpec
from app.evals.sampling import SamplePlan, build_sample_plan
from app.schemas.enums import EvalRunStatus
from app.schemas.evals import EvalRunConfig
from app.services.pipelines import PipelineService
from app.services.retrieval import RetrievalService
from app.utils.time import utc_now

logger = logging.getLogger(__name__)


def run_eval(run_id: UUID) -> None:
    """Background-task entry point: execute one pending eval run, never raise."""
    with session_scope() as session:
        run = session.get(models.EvalRun, run_id)
        if run is None or run.status != EvalRunStatus.PENDING.value:
            return
        try:
            EvalRunner(session).execute(run)
        except Exception:  # pylint: disable=broad-exception-caught
            # Deliberately broad: the failed status is already persisted on the
            # run row; a background task has no caller left to re-raise to.
            logger.exception("Eval run %s failed", run_id)


class EvalRunner:
    """Execute one eval run end to end against its recorded configuration."""

    def __init__(self, session: Session) -> None:
        """Bind the runner to its own background session."""
        self.session = session
        self.runs = EvalRunRepository(session)
        self.datasets = EvalDatasetRepository(session)

    def execute(self, run: models.EvalRun) -> None:
        """Drive the run through provisioning, evaluation, and aggregation."""
        try:
            self._execute(run)
        except Exception as exc:
            run.status = EvalRunStatus.FAILED.value
            run.error_message = str(exc) or exc.__class__.__name__
            run.completed_at = utc_now()
            self.session.add(run)
            self.session.commit()
            raise

    def _execute(self, run: models.EvalRun) -> None:
        """The run body; any exception is recorded as a failed run by `execute`."""
        user = self.session.get(models.User, run.user_id)
        dataset = self.session.get(models.EvalDataset, run.dataset_id)
        if user is None or dataset is None:
            raise ValueError("Eval run references a missing user or dataset.")
        config = EvalRunConfig.model_validate(run.config)
        plan = self._build_plan(dataset, config)

        run.status = EvalRunStatus.PROVISIONING.value
        run.progress_total = len(plan.corpus_doc_ids) + len(plan.query_ids)
        self.session.add(run)
        self.session.commit()

        provision = self._provision(run, user, dataset, plan)
        if self._cancelled(run):
            return

        run.status = EvalRunStatus.RUNNING.value
        self.session.add(run)
        self.session.commit()

        queries = self._sampled_queries(dataset.id, plan)
        qrels = self._qrels_by_query(dataset.id)
        mapping = EvalProvisioner(self.session).document_mapping(provision.collection.id)
        funnel_inputs = self._evaluate_queries(
            run, user, provision.collection, queries, qrels, plan, config, mapping,
            provision.indexed_external_ids,
        )
        if self._cancelled(run):
            return

        self._finalize(run, funnel_inputs)

    # -- phases ---------------------------------------------------------------

    def _build_plan(self, dataset: models.EvalDataset, config: EvalRunConfig) -> SamplePlan:
        """Sample queries, gold docs, and distractors for this run."""
        queries = self.datasets.list_queries(dataset.id)
        judgments = self.datasets.list_judgments(dataset.id)
        documents = self.datasets.list_documents(dataset.id)
        qrels: dict[str, set[str]] = {}
        for judgment in judgments:
            qrels.setdefault(judgment.query_external_id, set()).add(judgment.doc_external_id)
        return build_sample_plan(
            query_ids=[query.external_query_id for query in queries],
            qrels=qrels,
            corpus_doc_ids=[doc.external_doc_id for doc in documents],
            num_queries=config.num_queries,
            distractor_pool_size=config.distractor_pool_size,
            seed=config.seed,
        )

    def _provision(
        self,
        run: models.EvalRun,
        user: models.User,
        dataset: models.EvalDataset,
        plan: SamplePlan,
    ) -> ProvisionResult:
        """Ensure the eval collection exists and is ingested; track progress."""
        pipelines = PipelineService(self.session)
        ingestion = self._require_pipeline(pipelines, run.ingestion_pipeline_id, user.id)
        retrieval = self._require_pipeline(pipelines, run.retrieval_pipeline_id, user.id)
        provisioner = EvalProvisioner(self.session)
        cache_key = provisioner.cache_key_for(dataset, plan.corpus_hash, ingestion)
        corpus_docs = self.datasets.get_documents_by_external_ids(
            dataset.id, plan.corpus_doc_ids
        )

        def bump() -> None:
            run.progress_done += 1
            self.session.add(run)
            self.session.commit()

        run.status = EvalRunStatus.INGESTING.value
        self.session.add(run)
        self.session.commit()
        result = provisioner.provision(
            user=user,
            spec=ProvisionSpec(
                dataset=dataset,
                cache_key=cache_key,
                ingestion_pipeline=ingestion,
                retrieval_pipeline=retrieval,
            ),
            corpus_docs=corpus_docs,
            on_document_done=bump,
        )
        if result.reused:
            run.progress_done = len(plan.corpus_doc_ids)
        run.eval_collection_id = result.collection.id
        self.session.add(run)
        self.session.commit()
        return result

    # pylint: disable-next=too-many-arguments,too-many-positional-arguments,too-many-locals
    def _evaluate_queries(
        self,
        run: models.EvalRun,
        user: models.User,
        collection: models.Collection,
        queries: list[models.EvalDatasetQuery],
        qrels: dict[str, set[str]],
        plan: SamplePlan,
        config: EvalRunConfig,
        mapping: dict[str, str],
        indexed_external_ids: set[str],
    ) -> list[QueryFunnelInput]:
        """Run every sampled query, persisting each item as it completes."""
        retrieval = RetrievalService(self.session)
        corpus = set(plan.corpus_doc_ids)
        top_k = self._effective_top_k(config)
        funnel_inputs: list[QueryFunnelInput] = []
        for query in queries:
            if self._cancelled(run):
                return funnel_inputs
            gold = qrels.get(query.external_query_id, set()) & corpus
            item, funnel_input = self._evaluate_one(
                retrieval=retrieval,
                run=run,
                user=user,
                collection=collection,
                query=query,
                gold=gold,
                config=config,
                top_k=top_k,
                mapping=mapping,
                indexed_external_ids=indexed_external_ids,
            )
            self.runs.add_item(item)
            if funnel_input is not None:
                funnel_inputs.append(funnel_input)
            run.progress_done += 1
            self.session.add(run)
            self.session.commit()
        return funnel_inputs

    # pylint: disable-next=too-many-arguments,too-many-positional-arguments
    def _evaluate_one(
        self,
        *,
        retrieval: RetrievalService,
        run: models.EvalRun,
        user: models.User,
        collection: models.Collection,
        query: models.EvalDatasetQuery,
        gold: set[str],
        config: EvalRunConfig,
        top_k: int,
        mapping: dict[str, str],
        indexed_external_ids: set[str],
    ) -> tuple[models.EvalRunItem, QueryFunnelInput | None]:
        """Evaluate one query; a failure is recorded on the item, never fatal."""
        try:
            response = retrieval.query_collection(
                user,
                collection,
                query.text,
                top_k=top_k,
                arguments=config.run_inputs or None,
            )
        except Exception as exc:  # pylint: disable=broad-exception-caught
            # One provider hiccup fails one item, not the whole run.
            logger.warning("Eval query %s failed: %s", query.external_query_id, exc)
            return failed_item(run, query, gold, exc), None
        return score_query(
            run=run,
            query=query,
            gold=gold,
            config=config,
            mapping=mapping,
            indexed_external_ids=indexed_external_ids,
            response=response,
            node_runs=self._node_runs(response.pipeline_run_id),
        )

    def _finalize(self, run: models.EvalRun, funnel_inputs: list[QueryFunnelInput]) -> None:
        """Aggregate metrics and the funnel, then mark the run completed."""
        items = self.runs.list_items(run.id)
        run.aggregate_metrics = aggregate_metrics_mean(
            [item.metrics for item in items if not item.failed]
        )
        funnel = build_funnel(funnel_inputs, edges=self._retrieval_edges(run))
        run.funnel_summary = funnel.model_dump(mode="json")
        run.status = EvalRunStatus.COMPLETED.value
        run.completed_at = utc_now()
        self.session.add(run)
        self.session.commit()

    # -- helpers ---------------------------------------------------------------

    def _sampled_queries(
        self, dataset_id: UUID, plan: SamplePlan
    ) -> list[models.EvalDatasetQuery]:
        """Load the sampled queries in plan order."""
        sampled = set(plan.query_ids)
        queries = [
            query
            for query in self.datasets.list_queries(dataset_id)
            if query.external_query_id in sampled
        ]
        return sorted(queries, key=lambda query: query.external_query_id)

    def _qrels_by_query(self, dataset_id: UUID) -> dict[str, set[str]]:
        """Group the dataset's qrels by query external id."""
        qrels: dict[str, set[str]] = {}
        for judgment in self.datasets.list_judgments(dataset_id):
            qrels.setdefault(judgment.query_external_id, set()).add(judgment.doc_external_id)
        return qrels

    def _node_runs(self, pipeline_run_id: UUID | None) -> list[models.PipelineNodeRun]:
        """Load the recorded node runs for one query's pipeline run, in order."""
        if pipeline_run_id is None:
            return []
        statement = (
            select(models.PipelineNodeRun)
            .where(col(models.PipelineNodeRun.run_id) == pipeline_run_id)
            .order_by(col(models.PipelineNodeRun.sequence_index))
        )
        return list(self.session.exec(statement).all())

    def _retrieval_edges(self, run: models.EvalRun) -> list[tuple[str, str]]:
        """Read (source, target) edges off the retrieval pipeline definition."""
        pipeline = self.session.get(models.Pipeline, run.retrieval_pipeline_id)
        if pipeline is None:
            return []
        definition = PipelineService(self.session).get_definition(pipeline)
        return [(edge.source, edge.target) for edge in definition.edges]

    def _cancelled(self, run: models.EvalRun) -> bool:
        """Cooperative cancellation: re-read the run's status from the DB."""
        self.session.refresh(run)
        return run.status == EvalRunStatus.CANCELLED.value

    @staticmethod
    def _require_pipeline(
        pipelines: PipelineService, pipeline_id: UUID, user_id: UUID
    ) -> models.Pipeline:
        """Return the user-owned pipeline or fail the run with a clear reason."""
        pipeline = pipelines.get_pipeline(pipeline_id, user_id)
        if pipeline is None:
            raise ValueError("Eval run references a pipeline that no longer exists.")
        return pipeline

    @staticmethod
    def _effective_top_k(config: EvalRunConfig) -> int:
        """Fetch enough results to score the largest configured cutoff."""
        explicit = config.run_inputs.get("top_k")
        if isinstance(explicit, int) and explicit > 0:
            return explicit
        return max(config.k_values) if config.k_values else 10
