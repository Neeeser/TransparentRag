# AGENTS.md instruction hierarchy audit

> Status: audit-only review gate for [issue #77](https://github.com/Neeeser/Ragworks/issues/77). This document proposes dispositions; it does not authorize or perform edits to `AGENTS.md`, `app/AGENTS.md`, or `frontend/AGENTS.md`.

## Executive finding

The hierarchy contains valuable incident-derived safeguards, but its current size prevents Codex from receiving the full child instructions under the documented default budget. The root file is 10,998 bytes, the backend file is 61,608 bytes, and the frontend file is 24,077 bytes. No `project_doc_max_bytes` override is configured, so the documented 32 KiB combined default applies. Fresh `codex exec` runs from `app/` and `frontend/` each logged that the child file was truncated with 21,770 bytes remaining.

The consolidation should preserve the root invariants, shrink each always-loaded file to operative rules, and relocate subsystem explanations and conditional checklists. It must also correct three confirmed stale/conflicting statements before prose reduction:

1. The root command summary says release bump commands commit/tag for manual push, while the detailed release section, `Makefile`, script, and workflows use a release PR and workflow-created tag.
2. `frontend/AGENTS.md` says the repository has no CI, while `.github/workflows/ci.yml` exists and the root file describes it.
3. `app/AGENTS.md` tells chat code to raise `ValueError("Chat session not found.")`, while the earlier typed-error rule and current chat code use `InvalidInputError`.

No arbitrary line-count target is proposed. The target is full delivery within the configured budget, unambiguous retrieval, and no loss of the safeguards listed in issue #77.

## Review criteria and source authority

### Official guidance

- OpenAI says `AGENTS.md` is durable project guidance, should stay small, should contain rules that matter every time, and should place guidance in the closest applicable directory. It also recommends pairing guidance with linters, type checkers, hooks, and other enforcement: [Customization — AGENTS guidance](https://learn.chatgpt.com/docs/customization/overview#agents-guidance).
- OpenAI documents root-to-working-directory discovery, nearer-file precedence, and a 32 KiB default combined `project_doc_max_bytes`: [Custom instructions with AGENTS.md — discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md#how-codex-discovers-guidance) and [Advanced configuration — project instructions discovery](https://learn.chatgpt.com/docs/config-file/config-advanced#project-instructions-discovery).
- Anthropic independently recommends short, human-readable persistent instructions; retaining commands, repository-specific architecture and non-obvious gotchas; moving conditional workflows to skills; removing discoverable or self-evident material; and testing whether behavior changes: [Claude Code best practices — effective CLAUDE.md](https://code.claude.com/docs/en/best-practices#write-an-effective-claudemd).

These are review heuristics, not Ragworks requirements. When official product guidance and a proven Ragworks failure mode differ, the Ragworks invariant stays and only its placement or wording changes.

### Ragworks invariants

The repository itself is authoritative for gates, contracts, configuration ownership, security boundaries, provider integration behavior, release automation, and incident-derived failure modes. Mechanical sources (`Makefile`, workflows, lint/type/test configuration, schemas, and tests) outrank stale prose when they demonstrably conflict.

## Inventory and budget

| Scope | Lines | Words | Bytes | Delivery from that directory at default budget |
| --- | ---: | ---: | ---: | --- |
| Root `AGENTS.md` | 177 | 1,541 | 10,998 | Complete |
| Backend `app/AGENTS.md` | 862 | 8,078 | 61,608 | Truncated after 21,770 child bytes |
| Frontend `frontend/AGENTS.md` | 365 | 3,430 | 24,077 | Truncated after 21,770 child bytes |
| All files | 1,404 | 13,049 | 96,683 | Not deliverable as one chain |

There are 140 strong imperative markers (`MUST`, `NEVER`, `must`, `never`, `do not`, `required`, or `always`). Every coherent block containing one is accounted for below. Only these three repository instruction files exist; proposed nested destinations are new scope boundaries subject to review.

## Baseline orientation checks

On 2026-07-13, Codex CLI `0.144.0-alpha.4` ran the same read-only prompt from the repository root, `app/`, and `frontend/` using `gpt-5.6-sol` at medium reasoning. Each run was asked—without answers—to identify applicable instruction precedence, gates, regression testing, contract ownership, placement/dependency rules, non-obvious pitfalls, and release/README rules. No files were edited and no test suite was run.

| Working directory | Delivery evidence | Correct recall | Omissions/conflicts |
| --- | --- | --- | --- |
| Root | Root file loaded completely; agent manually opened both child files for the cross-stack prompt. | All requested categories; distinguished received vs inferred rules. | Detected the release-command contradiction and CI contradiction. Reading both child files consumed about 50k tokens, demonstrating poor orientation efficiency. |
| `app/` | CLI warning: `app/AGENTS.md` truncated with `remaining_bytes=21770`; agent manually reopened later ranges. | Backend/root gates, red-green, schema ownership, dependency direction, placement, many provider/DB/streaming pitfalls. | Detected both root/frontend conflicts. The first-pass instruction chain cannot include backend sections after roughly line 330; later rules were recovered only through explicit file reads. |
| `frontend/` | CLI warning: `frontend/AGENTS.md` truncated with `remaining_bytes=21770`; agent manually inspected the file. | Frontend/root gates, contract mirror, component/API boundaries, UI primitives, hydration/accessibility, release rules. | Detected both conflicts. The default chain cuts off around the UI primitives/server-boundary area, making later accessibility, testing, environment, and known-gap content unreliable without rereading. |

The post-consolidation check must reuse this prompt and model settings. Passing means no truncation warning, no contradiction, and equal or better correct recall without manually reopening broad instruction files.

## Disposition legend

- **Keep**: durable, non-obvious, and broadly applicable at its scope.
- **Condense**: preserve the operative rule and necessary rationale, remove anecdote/tutorial detail.
- **Move closer**: preserve in a narrower `AGENTS.md`, architecture reference, code comment, or skill.
- **Replace with enforcement + pointer**: retain the command, intent, and response to failure while pointing at the deterministic source.
- **Remove**: stale, duplicated, generic, or reliably discoverable; risk and rationale are recorded.
- **Correct**: update a conflict/inaccuracy before consolidation.

## Root inventory

| ID | Source | Section/rule | Disposition | Destination | Rationale | Risk if removed |
| --- | --- | --- | --- | --- | --- | --- |
| R01 | `AGENTS.md:1-12` | Project identity and routing to backend/frontend instructions | Keep | Root | Scope routing is essential and currently correct. Add explicit nearer-file precedence and cross-stack “load both” wording. | Agents may miss child rules or assume a child replaces root rules. |
| R02 | `AGENTS.md:14-23` | Area-routed verification gates and changed-area rule | Keep | Root | This is the canonical gate selector; child files should name only their extra local detail. | Changes could ship without the correct gate or run irrelevant gates. |
| R03 | `AGENTS.md:25-31` | Bug fixes require same-commit, verified red-green regression tests | Keep | Root | Proven cross-repository workflow and explicit acceptance requirement. | Regressions recur and tests may be added without demonstrating diagnostic value. |
| R04 | `AGENTS.md:33-42` | Scoped conventional commits, branch/PR, one concern, cross-contract synchronization, release-notes label | Keep | Root | All are cross-cutting repository etiquette or CI/release requirements. | Broken CI label gate, drifted API mirror, or direct-main work. |
| R05 | `AGENTS.md:44-67` | Release-PR architecture, workflow-created tags/images/releases, `edge`, shared build workflow, CI | Condense | Root invariant + `docs/DEVELOPMENT.md` release reference | Keep “release PR; never direct main/tag,” version owner, trigger, stable/RC/edge semantics; move workflow narration to canonical release docs. | Incorrect release/tag/image publication if reduced to a vague link. |
| R06 | `AGENTS.md:69-81` | Shipped Compose invariants, JWT persistence, separate volumes, same-origin runtime proxy, README mirror | Condense | Root coupling/security invariants + deployment architecture reference | Preserve no-env quick start, port, secret persistence, volume separation, runtime proxy, and byte-identical mirror. Move explanatory history. | Broken quick start, rotated identity secret, build-time proxy error, README drift. |
| R07 | `AGENTS.md:83-119` | Three-layer configuration architecture, DB override precedence, empty embedding default, frontend API-client-only, narrow backend config volume | Keep/Condense | Root | Settled cross-stack architecture. Shorten endpoint/tutorial detail but preserve every source of truth, prohibition, precedence, and empty-default rationale. | Split configuration owners, secret exposure, stale default models, or runtime settings in env/files. |
| R08 | `AGENTS.md:123-127` | Read downloaded Pinecone/OpenRouter docs before integration changes | Keep | Root | Non-obvious version-pinning safeguard. Add “run downloader when absent,” since fresh worktree lacks gitignored directories. | Agents rely on memory or current web docs that differ from locked integrations. |
| R09 | `AGENTS.md:128-130` | `app/schemas/` owns wire contract; frontend mirror changes in same PR | Keep | Root | Critical cross-side invariant. | Backend/frontend contract drift. |
| R10 | `AGENTS.md:131-134` | Exact-case canonical chat parameter keys | Keep | Root or backend schema pointer | Cross-side input requirement with a proven sanitizer narrowing. Condense implementation history. | Silently ignored provider/chat parameters. |
| R11 | `AGENTS.md:135-136` | Add incident-derived rules incrementally | Correct | Root maintenance policy | “Always add a line” caused unbounded growth. Replace with qualification: add only durable, narrow, proven rules; prefer enforcement/reference and prune stale material. | Without a feedback loop, known failures recur; without correction, files keep bloating. |
| R12 | `AGENTS.md:138-147` | README audience, tone, header/badge/style rules | Move closer | `docs/README-maintenance.md` or README-focused skill; root pointer only | Conditional editorial workflow, not applicable to every code task. | README quality may drift if moved without an explicit trigger/pointer. |
| R13 | `AGENTS.md:148-150` | Compose block mirrors YAML and YAML has no explanatory comments | Remove duplicate/Keep once | R06 canonical root rule | Duplicates R06. Merge into one operative coupling rule. | None if R06 retains exact byte-identical requirement. |
| R14 | `AGENTS.md:151-156` | `make readme-assets`, generated assets, size/render/visual/link verification | Move closer | README asset skill or `docs/README-maintenance.md`; root trigger | Substantial conditional procedure is a skill/reference, while the trigger remains in root. | Generated animations may be stale or visually broken if trigger disappears. |
| R15 | `AGENTS.md:158-177` | Make command catalog | Replace with enforcement + pointer; Correct | `make help`, `Makefile`, concise root gate/release commands | Mostly discoverable and volatile. Retain commands required by gates and common setup; correct bump commands to “open release PR,” matching `Makefile`. | Agents may use wrong command if the pointer is vague; release line is actively dangerous until corrected. |

## Backend inventory

| ID | Source | Section/rule | Disposition | Destination | Rationale | Risk if removed |
| --- | --- | --- | --- | --- | --- | --- |
| B01 | `app/AGENTS.md:1-5` | Backend scope and root-rule inheritance | Keep | Backend root | Necessary scope/precedence statement. | Duplicate or conflicting root rules. |
| B02 | `app/AGENTS.md:7-24` | Gate stages, coverage, no threshold lowering | Condense | Backend root + root R02 + `Makefile`/`pyproject.toml` | Keep `make verify`, `make coverage`, `term-missing`, and failure response; stage internals are enforced/discoverable. | Missed coverage review or threshold suppression. |
| B03 | `app/AGENTS.md:26-36` | Tests never require live provider credentials; future smoke tests opt-in and isolated | Keep/Condense | Backend testing rules | Non-obvious collection/security invariant. Remove removed-suite history. | Tests become credential-dependent or flaky/live. |
| B04 | `app/AGENTS.md:38-49` | mypy/ruff exceptions only for demonstrated third-party gaps | Replace with enforcement + pointer | `pyproject.toml` + concise backend rule | Keep prohibition and review standard; remove phase history and volatile exception narration. | Agents park owned code behind ignores. |
| B05 | `app/AGENTS.md:51-58` | 400-line module guard, no new grandfathering/disable | Replace with enforcement + pointer | `tests/test_module_size.py` + concise backend rule | Deterministically enforced; preserve expected response to a failure. | Agents weaken the guard instead of splitting modules. |
| B06 | `app/AGENTS.md:60-153` | Full file-by-file backend layout map | Move closer | `docs/backend-architecture.md` (new) | Useful architecture reference but too large and volatile for every backend task. Keep only ownership/dependency summary in AGENTS. | Misplacement if moved without routing; stale map if retained. |
| B07 | `app/AGENTS.md:155-157` | New code belongs to existing owner; new folder only for a real boundary | Keep | Backend root | Durable placement decision. | Folder proliferation and unclear ownership. |
| B08 | `app/AGENTS.md:159-166` | Package requires at least two cohesive modules | Condense | Backend root | Repository-specific structural convention; remove phase anecdote. | Single-file package clutter. |
| B09 | `app/AGENTS.md:168-174` | Package `__init__` exposes only public API; patch real import boundary | Keep/Condense | Backend root/testing rules | Prevents re-export/monkeypatch coupling. | Hidden foreign API and tests patched at the wrong boundary. |
| B10 | `app/AGENTS.md:176-190` | Pipeline nodes group by stage; shared/local validators; config-model validation | Move closer | `app/pipelines/AGENTS.md` (new) | Always relevant to pipeline edits, not all backend work. Preserve all three invariants. | Duplicated nodes, divergent validation, or raw-config/default drift. |
| B11 | `app/AGENTS.md:192-205` | `PipelineRunner` owns run lifecycle and trace status | Move closer | `app/pipelines/AGENTS.md` + architecture reference | Subsystem ownership and incident rationale. | Duplicate/inconsistent run lifecycle or failed status persistence. |
| B12 | `app/AGENTS.md:207-218` | Registry-driven config resolution; no duplicated node IDs/tables | Move closer | `app/pipelines/AGENTS.md` | Subsystem lockstep safeguard. | New node variants require hidden second updates or resolve incorrectly. |
| B13 | `app/AGENTS.md:220-233` | Variadic fan-in, fusion, hybrid defaults, all-target purge, graceful missing-index behavior | Move closer | `app/pipelines/AGENTS.md` + architecture reference | Multiple operative pipeline/data-integrity invariants; remove roadmap detail. | Edge clobbering, incomplete purges, or avoidable query failures. |
| B14 | `app/AGENTS.md:235-239` | Pipeline resolution has one service owner and typed error | Move closer | `app/services/AGENTS.md` or `app/pipelines/AGENTS.md` | Cross-caller subsystem boundary. | Duplicated resolution sequences and wrong HTTP/domain errors. |
| B15 | `app/AGENTS.md:235-239` | DB model modules and flat public import namespace | Move closer | `app/db/AGENTS.md` (new) | DB-specific ownership rule. | External imports couple to internal module layout. |
| B16 | `app/AGENTS.md:240-244` | `core ← schemas ← db/clients ← domain ← services ← api` | Keep | Backend root | Primary backend dependency invariant. | Circular/upward imports and mixed responsibilities. |
| B17 | `app/AGENTS.md:245-250` | Settings live in core; lower layers never import API | Keep/Condense | Backend root | Concrete application of B16; remove migration history. | Core/db/services depend on route assembly. |
| B18 | `app/AGENTS.md:251-262` | Secure debug/JWT defaults; config vs upload storage | Keep/Remove duplicate | Root configuration/security invariant + backend pointer | Keep `DEBUG=false` and secret behavior; root already owns volume split. | Insecure deployments or identity loss if security clauses vanish. |
| B19 | `app/AGENTS.md:263-269` | Thin routes: parse → service → shape/translate; no DB/client/orchestration | Keep | Backend root | Durable and non-obvious dependency boundary. | Business logic and security/error mapping leak into routes. |
| B20 | `app/AGENTS.md:270-281` | Admin routes share router gate; enum; startup/admin invariants | Move closer | `app/api/AGENTS.md` + auth architecture reference | Security-critical but scoped. Preserve last-admin and server-side enforcement; move accepted race discussion to code/docs. | Ungated admin endpoints or loss of last admin. |
| B21 | `app/AGENTS.md:282-292` | Multi-store destructive operations and domain behavior live in services | Keep/Condense | Backend root | Core dependency/data-integrity rule. | Partial deletion or route orchestration. |
| B22 | `app/AGENTS.md:293-308` | Typed `ServiceError` taxonomy and single route translation | Keep/Condense | Backend root | Critical wire/error contract. Remove migration history; retain 400 preservation note where current. | Raw 500s, message-matched status, or wire status drift. |
| B23 | `app/AGENTS.md:309-316` | Classify provider errors at service boundary without masking internal bugs | Keep | Backend root | Important observability and correctness rule. | Internal defects mislabeled as upstream failures or raw SDK errors leak. |
| B24 | `app/AGENTS.md:317-324` | TraceService owns trace response construction | Move closer | `app/services/AGENTS.md` or trace architecture doc | Feature ownership, not universal backend guidance. | Routes regress to direct DB joins and incomplete response mapping. |
| B25 | `app/AGENTS.md:325-340` | Queries only in repositories; schema/persistence separation; enums schema-owned | Keep/Condense | Backend root + `app/db/AGENTS.md` detail | Foundational data/contract boundaries. | Inline query duplication, leaked DB fields, or schema→SQLModel dependency. |
| B26 | `app/AGENTS.md:341-352` | Pipeline engine/wire-type exception and registry singleton | Move closer | `app/pipelines/AGENTS.md` | Pipeline-specific contract exception. | Duplicate models, schema inheritance coupling, or inconsistent registry. |
| B27 | `app/AGENTS.md:354-372` | End-to-end backend feature checklist | Move closer | Project skill for “add backend feature”; backend one-line pointer | Conditional multi-step workflow is skill-shaped. | Contract-first ordering and cross-side update could be missed if trigger is weak. |
| B28 | `app/AGENTS.md:374-407` | AppConfig field/enforcement/public mirror/test/admin catalog checklist | Move closer | Project skill + config architecture reference | Conditional detailed workflow. Keep runtime-config source-of-truth invariant in root/backend. | Settings added to env layer, cached incorrectly, or omitted from public mirror. |
| B29 | `app/AGENTS.md:409-416` | Add-vector-backend checklist | Move closer | `app/vectorstores/AGENTS.md` or project skill | Conditional subsystem workflow. | Incomplete registration/capability/node integration. |
| B30 | `app/AGENTS.md:417-427` | Capabilities declared once; pgvector/Pinecone limits and halfvec query symmetry | Move closer | `app/vectorstores/AGENTS.md` + provider architecture doc | Preserve lockstep and planner-critical rules; move numeric/version detail near implementation. | Divergent validation or index not used. |
| B31 | `app/AGENTS.md:428-449` | Single vector-store prerequisite gate; safe DDL/name validation; extension best effort | Move closer | `app/vectorstores/AGENTS.md` | Security/availability invariants scoped to vector stores. | Key-gate duplication, unsafe identifiers, or startup failure. |
| B32 | `app/AGENTS.md:450-465` | Backend-native BM25 plane, batch/model/index naming, extension behavior | Move closer | Vector-store architecture reference + nested AGENTS operative bullets | Large feature narration; retain constraints close to code. | Sparse search silently incompatible or incorrectly provisioned. |
| B33 | `app/AGENTS.md:466-472` | Node type IDs permanent; per-document deletion uses backend API | Move closer | `app/pipelines/AGENTS.md` / `app/vectorstores/AGENTS.md` | Persisted-ID and deletion-integrity rules. | Existing pipelines break or whole namespace is deleted. |
| B34 | `app/AGENTS.md:474-496` | FileNode/Document semantics, uploads persist, background session, node-keyed bytes, navigation surface | Move closer | `app/services/AGENTS.md` or `app/services/files/AGENTS.md` if a real boundary exists | Cohesive file-tree subsystem invariants. | Ghost ingestion states, lost uploads, closed-session failures, rename I/O, API drift. |
| B35 | `app/AGENTS.md:498-528` | Telemetry never breaks feature, own session, post-commit hook, repository aggregation, domain-event boundary | Move closer | `app/telemetry/AGENTS.md`; checklist can be skill | Explicit exception to error-swallow rule must remain scoped. | Telemetry failures break product flows or participate in transactions. |
| B36 | `app/AGENTS.md:530-539` | Backend bug workflow repeats root | Remove duplicate/Condense to pointer | Root R03; backend one sentence about lowest layer | Root owns red-green. Preserve backend layer ordering only. | None if backend pointer remains clear. |
| B37 | `app/AGENTS.md:543-588` | Strong typing, Optional narrowing, boundary validation, schema-vs-dict, data-oriented models | Condense | Backend root | Preserve concrete prohibitions/exceptions; remove generic tutorial and long incidents. | `Any`, casts, raw dict fallbacks, or unstable shape bugs return. |
| B38 | `app/AGENTS.md:589-599` | OO-with-state, one responsibility, abstraction timing | Remove/Condense | Architecture review skill or no replacement | Mostly generic design advice; retain only repository-enforced file limit and lockstep-duplication rule elsewhere. | Low; wrong abstraction risk is real but not Ragworks-specific enough for always-loaded context. |
| B39 | `app/AGENTS.md:600-608` | Streaming/non-streaming chat path shares implementation | Move closer | `app/chat/AGENTS.md` (new) | Chat-specific incident invariant. | Hand-synced loops/constants drift. |
| B40 | `app/AGENTS.md:609-631` | Contract docstrings, pylint handling, dead code, import-time side effects | Condense/Replace with enforcement | Backend root + lint config; import-time exception retained | Remove generic/history; keep disable-comment response and two explicit import-time ownership exceptions. | Suppressed design warnings, dead parallel implementations, or hidden startup effects. |
| B41 | `app/AGENTS.md:634-661` | Sync/async boundary, request/process state, Pydantic v2, SQLModel validation, session owner, JSON reassignment | Keep/Condense | Backend root or `app/db/AGENTS.md` for DB items | Non-obvious stack pitfalls with reachable failures. | Event-loop stalls, shared request state, validation bypass, detached objects, or lost JSON writes. |
| B42 | `app/AGENTS.md:662-672` | Streaming lifetime and partial persistence on disconnect/provider error | Move closer | `app/chat/AGENTS.md` | Streaming-specific resource/data-integrity rule. | Lost partial messages, leaked resources, or swallowed provider errors. |
| B43 | `app/AGENTS.md:673-678` | Cross-user session resolution says raise `ValueError` | Correct | `app/chat/AGENTS.md` or code-adjacent comment | Current code and B22 use `InvalidInputError`; preserve user-scoped lookup and anti-collision behavior, correct exception. | Following current prose reintroduces 500/wire inconsistency; removing ownership check risks cross-user access. |
| B44 | `app/AGENTS.md:679-710` | Typed provider clients, local docs, OpenRouter dimensions/error, pinned-SDK behavior, resource-owning cache | Move closer | `app/clients/AGENTS.md` (new); root retains docs trigger | Provider-client-specific non-obvious rules. | Untyped wire data, rejected embeddings, dead SDK branches, leaked clients/secrets. |
| B45 | `app/AGENTS.md:711-746` | AppConfig cache invalidation and call-time settings reads with two exceptions | Move closer/Keep pointer | Config service tests/reference; concise backend root warning | Essential but detailed fixture/tutorial can live near config. | Stale test/config reads or frozen import-time settings. |
| B46 | `app/AGENTS.md:747-752` | Every response schema field populated; grep construction sites | Keep | Backend root contract rules | Generic schema defaults can hide data loss; proven wire pitfall. | Silent omission of internal result fields. |
| B47 | `app/AGENTS.md:754-842` | Behavior-focused test placement, TestClient, failure paths, boundary mocks, persistence fresh session, coverage reasoning, no stub-body tests | Condense | Backend testing section + project testing skill/reference | Preserve operative diagnostics and database read-back trap; remove audit anecdotes and repeated formulations. | Vacuous tests, ownership/security gaps, identity-map false positives, hanging sessions. |
| B48 | `app/AGENTS.md:843-849` | Patches use `monkeypatch`; no fake instance dunders | Keep/Condense | Backend testing rules | Concrete order-dependence and Python lookup traps. | Cross-test pollution or misleading fakes. |
| B49 | `app/AGENTS.md:851-862` | Known gaps: no hard delete; plaintext provider keys | Move closer | Tracked GitHub issues/security architecture doc; keep only current security invariant if needed | Transient status is not persistent instruction. No linked issue IDs currently make “tracked” auditable. | Security debt becomes invisible if moved without explicit issues; leaving it here consumes context and goes stale. |

## Frontend inventory

| ID | Source | Section/rule | Disposition | Destination | Rationale | Risk if removed |
| --- | --- | --- | --- | --- | --- | --- |
| F01 | `frontend/AGENTS.md:1-7` | Frontend scope and root inheritance | Keep/Condense | Frontend root | Necessary routing; remove generic “hold in head” prose. | Root/child precedence ambiguity. |
| F02 | `frontend/AGENTS.md:9-18` | Verify gate, lint structural rules, warning/disable response | Condense/Replace with enforcement + pointer | Frontend root + `package.json`/ESLint config | Keep `npm run verify`, format check via root, no new grandfathering/disable-max-lines; detailed rule list is discoverable. | Agents suppress lint or ignore new warnings. |
| F03 | `frontend/AGENTS.md:20-41` | Frontend directory tree | Move closer | `docs/frontend-architecture.md` (new) | Useful but mostly discoverable and volatile. Keep a short ownership map in AGENTS. | Misplaced code if routing pointer is weak. |
| F04 | `frontend/AGENTS.md:43-45` | Owner folder, second-use promotion, no single-file feature folder | Keep/Condense | Frontend root | Repository-specific placement and reuse threshold. | Premature globals or folder clutter. |
| F05 | `frontend/AGENTS.md:47-54` | Trace values use ordered renderer registry and bounded scroll | Move closer | `frontend/src/components/traces/AGENTS.md` or architecture/code comment | Feature-specific extension point with layout invariant. | Switch growth, wrong renderer order, or reflowing trace UI. |
| F06 | `frontend/AGENTS.md:56-63` | File preview matcher, safe HTML/SVG, authenticated blob, remount, no nested buttons | Move closer | `frontend/src/components/files/AGENTS.md` | Cohesive feature/security/hydration rules. | XSS/live SVG, auth failures, stale preview state, invalid HTML/hydration errors. |
| F07 | `frontend/AGENTS.md:65-82` | End-to-end frontend feature checklist and Chat Studio example | Move closer | Project skill for “add frontend feature”; concise frontend pointer | Conditional workflow and example. | API/hook/component/page/test ordering and primitive reuse may be missed. |
| F08 | `frontend/AGENTS.md:84-92` | Frontend bug workflow repeats root | Remove duplicate/Condense to pointer | Root R03; frontend retains lowest-layer ordering | Root owns same-commit red-green. | None if child points clearly and names reducer/hook/component order. |
| F09 | `frontend/AGENTS.md:96-99` | ~300-line design signal, 400-line hard ceiling | Replace with enforcement + pointer | ESLint + concise frontend rule | Preserve split response; remove anecdote. | Agents disable guard or keep oversized orchestrators. |
| F10 | `frontend/AGENTS.md:100-111` | Component/hook/helper responsibilities, reducers for related state, thin pages | Keep/Condense | Frontend root | Defines frontend architecture beyond generic React advice. | Stateful components and logic-heavy pages. |
| F11 | `frontend/AGENTS.md:113-115` | Hybrid graph shared nodes centered between branches | Move closer | Ragworks UI design skill or pipeline editor architecture | Pure visual/layout rule; applicable design skill already exists. | Crossed edges and degraded graph readability. |
| F12 | `frontend/AGENTS.md:116-131` | Feature folder organization, Chat Studio decomposition, pure reducer modules | Condense/Move example | Frontend root invariant + frontend architecture reference | Keep folder/reducer contract; move volatile file counts and history. | Feature boundaries blur or reducers become React-coupled. |
| F13 | `frontend/AGENTS.md:132-139` | Group props by domain; memo requires stable props | Condense | Frontend root or performance reference | Keep domain ownership/stability rule, remove incident numbers. | Prop drilling and ineffective memoization during streaming. |
| F14 | `frontend/AGENTS.md:140-154` | Hydration-safe defaults, derive not effect-copy, preserve async ordering when replacing effects | Keep/Condense | Frontend root | Non-obvious React failure modes, including proven data-loss path. | Hydration mismatch, stale render, extra renders, lost late-arriving data, loops. |
| F15 | `frontend/AGENTS.md:155-157` | Delete dead code on sight | Remove | No replacement beyond lint/review policy | Generic and absolute; deterministic unused-code checks cover much of it. | Low; unflagged semantic dead code may persist, handled in review. |
| F16 | `frontend/AGENTS.md:159-179` | Second-copy extraction, derived types, single constants, local UI state, quarantined patches | Condense | Frontend root | Preserve reuse threshold/local-state/patch rules; merge overlapping duplication bullets. | Drifted copies, prop drilling, or global monkey patches. |
| F17 | `frontend/AGENTS.md:183-200` | Typecheck, no suppressions, narrowing, library generics, domain wire types | Condense/Move closer | Frontend root; version-specific generic examples to code/reference | Keep no `any`/ignore, domain mirror and no escape hatch. Typecheck duplicates gate. | Hidden type bugs or contract drift. |
| F18 | `frontend/AGENTS.md:204-224` | All network calls in API layer; token first; typed shared errors; client boundary; dynamic admin catalog | Keep/Condense | Frontend root; admin detail to config architecture | Strong API-client boundaries and same-type argument trap. | Stray fetches, token/id swaps, duplicated errors, config form drift. |
| F19 | `frontend/AGENTS.md:228-245` | `useApiQuery`, surfaced fetch errors, `useAppConfig`, permissive explicit-false flags | Keep | Frontend root | Canonical services and subtle loading/fallback behavior. | Races, swallowed errors, duplicate config fetches, feature flicker. |
| F20 | `frontend/AGENTS.md:249-268` | Modal, fields, confirmations, wizards, loading button, nested-dialog behavior | Keep/Condense | Frontend root primitives catalog or UI skill with mandatory trigger | Canonical shared primitives encode accessibility/behavior. | Bespoke inconsistent dialogs/forms, focus failures, broken accessible names. |
| F21 | `frontend/AGENTS.md:269-276` | Clear stale feedback; `cn` class-only conflict semantics | Keep/Move detail | Frontend root for feedback; UI primitive reference for `cn` | Proven state and styling pitfalls. | Contradictory banners or unstable class resolution/ARIA IDs. |
| F22 | `frontend/AGENTS.md:277-280` | Accessibility is part of done; names/labels/state/keyboard; user-event | Keep | Frontend root | Explicit preservation requirement and cross-UI invariant. | Inaccessible interaction and regressions missed by tests. |
| F23 | `frontend/AGENTS.md:282-301` | Client boundary, deterministic hydration, client-side token flow, server-enforced admin gate | Condense | Frontend root | Merge duplicate `use client`/hydration bullets; preserve intentional client architecture and security boundary. | Bundle bloat, hydration errors, one-off server architecture, client gate mistaken for security. |
| F24 | `frontend/AGENTS.md:303-309` | No debug console/effect logging | Replace with enforcement + pointer | ESLint/compiler + concise response rule | Mechanically enforced; retain warn/error exception and no logging-only effect if not linted. | Debug noise or streaming-time logging effects. |
| F25 | `frontend/AGENTS.md:311-316` | Pinned Node and Node ≥22.4/jsdom storage interaction | Keep/Condense | Frontend root/environment reference | Non-obvious reproducibility pitfall. | Mysterious storage test failures. |
| F26 | `frontend/AGENTS.md:320-332` | Behavior-not-wiring, forbidden vacuous tests, coverage floor | Condense | Frontend testing section/skill | Preserve diagnostic mutation question and explicit anti-patterns; remove history. | Tests pass without protecting behavior or inflate coverage. |
| F27 | `frontend/AGENTS.md:333-350` | Accessible queries/user-event, `act`, test-size signal, centralized mocks/fixtures, behavior names | Keep/Condense | Frontend testing section | `act` and centralized factory boundaries are concrete/proven; test naming is generic and can be removed. | Vacuous async assertions or mocks with wrong API signatures. |
| F28 | `frontend/AGENTS.md:352-365` | Known gaps/status list | Correct/Move closer/Remove | GitHub issues or `docs/DEVELOPMENT.md` | “No CI” is false. Other transient debt (E2E, generated types, compiler flags, warning counts, auth migration) should be tracked, not loaded every task. | Debt becomes invisible if moved without issue links; stale statements misdirect work if retained. |

## Confirmed conflicts, scope hazards, and reference checks

| Finding | Evidence | Required resolution |
| --- | --- | --- |
| Release command conflict | `AGENTS.md:44-67` and `Makefile:45,115-125` say release PR; `AGENTS.md:176-177` says commit/tag/push manually. | Correct R15 to the release-PR behavior; keep one canonical release invariant plus pointer. |
| CI conflict | `.github/workflows/ci.yml` exists; root describes PR/main CI; `frontend/AGENTS.md:354-355` says no CI. | Remove/correct F28 and track only current CI gaps. |
| Error taxonomy conflict | `app/AGENTS.md:293-308` forbids bare `ValueError`; line 676 requires it. `app/chat/{branching,persistence,setup}.py` raise `InvalidInputError`. | Correct B43 while preserving user ownership and existing wire behavior. |
| Default budget overflow | No config override; official default is 32 KiB; CLI emitted truncation warnings. | Consolidated root+child chain must fit, or the PR must intentionally add/document a project budget override. Prefer reducing always-loaded content rather than raising it. |
| Child-as-override ambiguity | Root says “load” child files; child headers say root rules live elsewhere, but neither explicitly states root→child merge/nearer precedence. | Add explicit precedence and cross-stack routing to R01/B01/F01. |
| Duplicate verification/bug rules | Root and each child restate the gate and red-green workflow with slightly different “before commit/finishing” wording. | Root owns applicability and red-green; children retain only area-specific command/detail. |
| Duplication threshold differs by scope | Backend says extract on third use or lockstep; frontend says second copy. | Not a conflict if clearly scoped; preserve each as an intentional area specialization or align explicitly during review. |
| Gitignored provider docs absent in fresh worktree | `docs/external-api/{openrouter,pinecone}/` do not exist until downloader scripts run. | R08 must tell agents to run the appropriate downloader when missing. |
| Historical deleted paths | Backend prose names removed `app/retrieval/indexing.py`, `app/retrieval/chunkers/text.py`, and `tests/integration/` as anecdotes. | Remove history during condensation; do not leave operative-looking pointers to deleted content. |

Checked current references:

- `AGENTS.md`, `app/AGENTS.md`, `frontend/AGENTS.md`, `Makefile`, `pyproject.toml`, `frontend/package.json`, `frontend/.nvmrc`, `.github/release.yml`, release workflows, `scripts/bump_version.py`, `docker-compose.yml`, `README.md`, `tests/test_module_size.py`, and the named current app/test files resolve.
- The issue’s OpenAI links resolve through the official OpenAI documentation service. The cited Anthropic page resolves on `code.claude.com` and currently contains the stated concise/human-readable/removal-test/behavior-test guidance.
- Provider-doc directories are intentionally gitignored and absent in this clean worktree; both downloader scripts resolve.
- No deeper `AGENTS.md` exists today, so every proposed nested file needs explicit owner signoff to avoid scattering tiny scopes.

## Preservation index

This index makes the issue’s non-negotiable safeguards reviewable independently of prose deletion.

| Safeguard | Audit IDs preserving it |
| --- | --- |
| Verification gates and applicability | R02, B02, F02 |
| Same-commit verified red-green regression tests | R03, B36, F08 |
| Backend schema/frontend mirror synchronization | R04, R09, B27-B28, B46, F07, F17-F18 |
| Configuration layering and sources of truth | R07, B18, B28, B45, F18-F19, F23 |
| External provider documentation requirement | R08, B44 |
| Release PR, label, Compose/README mirroring | R04-R06, R13-R15 |
| Security/data integrity | R06-R07, B18, B20-B23, B31-B35, B41-B44, B47-B49, F06, F20, F22-F23 |
| Dependency direction and ownership | B06-B26, F03-F06, F10-F12, F18-F19, F23 |
| Accessibility | F06, F20-F22, F27 |
| Framework/library pitfalls | B37, B41-B45, B47-B48, F13-F14, F17-F19, F23-F27 |
| Incident-derived reachable failures | Each row records risk; moves retain operative invariant and remove only history. |
| Canonical primitives/services | B11-B15, B19-B26, B29-B35, F05-F07, F18-F21 |
| Validation location | R07, B10, B16-B26, B28-B31, B37, B41, B46 |
| MUST/NEVER rules | All strong-imperative blocks are included in R01-R15, B01-B49, or F01-F28. A move/remove/correct row includes rationale and risk. |

## Proposed target hierarchy (for reviewer decision, not yet approved)

Recommended approach: a small three-file core plus a few real subsystem boundaries and canonical references.

1. Root `AGENTS.md`: repository routing, gate selector, red-green rule, PR/release/label requirements, configuration layers, contract synchronization, provider-doc trigger, Compose/README coupling, and instruction maintenance policy.
2. `app/AGENTS.md`: backend ownership/dependency direction, typed error/contract rules, universal DB/FastAPI pitfalls, and a short testing policy.
3. `frontend/AGENTS.md`: frontend ownership/API-client boundaries, canonical data/config/UI primitives, universal React/hydration/accessibility pitfalls, and a short testing policy.
4. Nested files only where a stable ownership boundary already exists and many rules apply to every edit there: candidate scopes are `app/pipelines/`, `app/vectorstores/`, `app/clients/`, `app/chat/`, `app/telemetry/`, and frontend trace/file feature folders. Reviewers may prefer architecture docs plus code comments for some candidates; no tiny file should be created for a single rule.
5. Skills for conditional, procedural work: add backend feature, add frontend feature, add runtime config, add vector backend, and README asset generation.
6. Architecture/reference docs for descriptive maps and volatile implementation detail. AGENTS pointers must name the trigger and exact source; vague “see docs” links are not replacements.
7. Mechanical enforcement remains canonical for line limits, lint/type rules, CI labels, release behavior, and schema/tests. AGENTS states intent and what to do when enforcement fails; it does not narrate the implementation.

Alternative A—only condense the existing three files—has the lowest file-count cost but leaves conditional subsystem rules loaded broadly and is unlikely to create durable budget headroom. Alternative B—many nested AGENTS files—maximizes locality but risks fragmentation and undiscoverable scope. The recommendation intentionally uses nested files only at established, multi-module ownership boundaries.

## Future maintenance policy proposal

Add or revise an instruction only when it captures repeated review feedback, a non-obvious repository invariant, or a demonstrated reachable failure mode. Put it at the narrowest scope where it is always applicable. Prefer a concise imperative plus enough rationale to prevent misapplication. Use deterministic enforcement for zero-exception rules, a skill for conditional multi-step workflows, a code comment for one implementation decision, and canonical architecture/reference docs for explanation.

Do not add generic language/framework advice, transient feature status, full tutorials, file-by-file maps, or facts reliably discoverable from code/configuration. When a new rule is proposed, state the failure it prevents, check for an existing canonical rule, and ask whether removing it would predictably increase mistakes. Review and prune instructions when architecture or enforcement changes. Any change to the hierarchy must rerun the root/backend/frontend orientation prompt, budget measurement, reference scan, and contradiction review.

## Decisions required at the mandatory review gate

No consolidation should begin until all three area owners sign off on the inventory relevant to them.

### Root/repository owner

- Approve or revise R01-R15 and the proposed canonical root scope.
- Confirm that detailed release/README procedures move to `docs/DEVELOPMENT.md`, a new maintenance reference, or a skill while the operative triggers remain in root.
- Confirm correction of the stale bump-command summary and the qualified future-instruction policy.
- Decide whether fitting the 32 KiB default chain is a hard acceptance criterion (recommended) or whether a repository `project_doc_max_bytes` override is intentionally desired.

### Backend owner

- Approve or revise B01-B49, especially each proposed nested scope versus architecture-doc/code-comment destination.
- Confirm the `InvalidInputError` correction for the client-supplied chat session rule.
- Confirm which “known gaps” have tracked issues and approve moving them out of persistent instructions.
- Confirm that provider/vector/pipeline/file/telemetry invariants remain complete after relocation and identify any row whose risk requires keeping it in `app/AGENTS.md`.

### Frontend owner

- Approve or revise F01-F28 and which feature-specific rules belong in the Ragworks UI design skill, nested feature guidance, or architecture docs.
- Confirm removal of the false “no CI” statement and decide how the remaining known gaps are tracked.
- Confirm that canonical primitives, API-client boundaries, hydration/effect pitfalls, accessibility, and testing traps remain in the always-loaded frontend core or have an equally reliable trigger.
- Confirm whether the frontend second-copy extraction threshold intentionally differs from backend abstraction timing.

After these decisions, the implementation pass should update the three files and any approved destinations, rerun the same orientation checks, compare recall category by category, verify every reference, and attach the before/after budget table. Until then, this issue is blocked at its required review gate.
