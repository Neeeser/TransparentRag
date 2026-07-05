# Frontend Modularization Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every finding from the 2026-07-05 frontend review — 227 TS errors, a user-facing crash, a red test suite, three god-components, missing shared layers, copy-paste duplication, wiring-only tests — and lock the fixes in with stronger lint/TS config and a `frontend/AGENTS.md`.

**Architecture:** Bottom-up: make the gates green first (test env, typecheck), then build the shared layers (typed API errors, `useApiQuery`, UI primitives), then decompose the god-components onto those layers, then overhaul tests, then add enforcement (lint rules, AGENTS.md). Every phase ends with `tsc --noEmit`, `vitest run`, and `eslint` green, and a commit.

**Tech Stack:** Next.js 16, React 19, TypeScript 5 strict, Tailwind 4, Vitest + Testing Library, ESLint 9 flat config + sonarjs.

## Global Constraints

- Behavior-preserving refactor: no feature changes except the listed bug fixes.
- Target file size: components/hooks ≤ ~300 lines; hard lint ceiling 400 lines (tests exempt).
- All work under `frontend/`; run all commands from `frontend/`.
- Keep `@/lib/api` and `@/lib/types` import specifiers working via barrel re-exports.
- Test philosophy: behavior over wiring. Deleting a low-value test is preferred over keeping it. Coverage thresholds drop to 70% lines / 60% branches.
- Verify after each task: `npm run typecheck && npx vitest run && npm run lint`.
- Commit after each task with a conventional message.

---

### Task 1: Green test environment + typecheck gate

**Files:**
- Modify: `frontend/src/test/setup.ts` (stub Web Storage)
- Modify: `frontend/package.json` (add `typecheck` script, `engines.node`)
- Create: `frontend/.nvmrc` (`22`)

**Why:** Node ≥22.4 ships a built-in `localStorage` whose methods throw without `--localstorage-file`, shadowing jsdom's; 45 tests fail with `TypeError: localStorage.setItem is not a function`. There is no `typecheck` script, so 227 `tsc` errors are invisible.

**Steps:**
- [ ] In `setup.ts`, before all tests, replace `globalThis.localStorage`/`sessionStorage` with an in-memory `Storage` implementation (`getItem/setItem/removeItem/clear/key/length`), reset in global `beforeEach`.
- [ ] Add `"typecheck": "tsc --noEmit"` to scripts; add `"engines": { "node": ">=22" }`; create `.nvmrc`.
- [ ] Run `npx vitest run` → expect 0 failures (379 tests).
- [ ] Commit.

### Task 2: Fix all TypeScript errors (mechanical)

**Files (fix in place):**
- `components/pipelines/PipelineBuilder.tsx`, `PipelineCanvas.tsx`, `PipelineNode.tsx` — @xyflow v12 generics take `Node<PipelineNodeData>`, not the data type: `useNodesState<Node<PipelineNodeData>>`, `NodeProps<Node<PipelineNodeData>>`, `OnNodesChange<Node<PipelineNodeData>>`.
- `components/collections/detail/CollectionOverview.tsx:55`, `components/collections/list/CreateCollectionWizard.tsx:74` — Map entries must be `[string, string]` tuples.
- `components/collections/detail/visualize/UmapCanvas.tsx` — narrow deck.gl `zoom` to number before arithmetic; fix `depthTest` param, tooltip text stringification.
- `components/chat-studio/ChatTimeline.tsx` — import `ReasoningTraceSegment`.
- `components/chat-studio/chat-utils.tsx:170` — remove stale `inline` prop handling per react-markdown v10 types.
- `components/chat-studio/telemetry/ModelParametersCard.tsx:106` — narrow `ParameterDefinition` union before reading `min/max/step/options/rows`.
- `components/chat-studio/ChatStudio.tsx` — `window.setTimeout` number ref types; `promptSections` explicit union type; `RefObject<T | null>` mismatches.
- Any remaining errors until `npm run typecheck` exits 0.

**Steps:**
- [ ] Fix each cluster; run `npm run typecheck` until 0 errors.
- [ ] `npx vitest run` green. Commit.

### Task 3: Bug fixes — provider search crash, console.debug, misc

**Files:**
- `components/chat-studio/telemetry/ProviderRoutingCard.tsx` — rename prop `setProviderSearchTerm` → `onProviderSearchChange` (align with caller).
- `components/chat-studio/ChatStudio.tsx` — delete all 8 `console.debug` calls and the two log-only effects; fix orphan `/* c8 ignore stop */`; delete no-op `handleReasoningToggle` and its drilled prop chain into `CollapsibleReasoning`; delete the 18-symbol re-export block (update importers to `chat-helpers`); delete unused `chatModel` from `resolveChatSettings`; delete `joinTextWithSpacing`.
- `components/chat-studio/Tooling.tsx:357` — add `catch` to `loadTrace`, surface error state.
- `components/traces/PipelineTraceViewer.tsx:294` — surface node-spec fetch failure instead of silently swallowing.
- `next.config.ts` — add `compiler.removeConsole = { exclude: ["error", "warn"] }` for production.
- `src/app/page.tsx:57` — dead `https://github.com` link → point at repo or remove button.

**Steps:** fix, typecheck+test green, commit.

### Task 4: Typed API errors + `useApiQuery`

**Files:**
- Create: `frontend/src/lib/api/client.ts` — `export class ApiError extends Error { constructor(public status: number, public detail: string) }`; move `apiFetch<T>`, base-URL handling here. 401 detection helper `isUnauthorized(err)`.
- Create: `frontend/src/lib/use-api-query.ts` —
  `export function useApiQuery<T>(fn: (signal?: AbortSignal) => Promise<T>, deps: unknown[], opts?: { enabled?: boolean }): { data: T | null; loading: boolean; error: string | null; reload: () => void }` — owns the cancelled-flag/AbortController lifecycle once.
- Create: `frontend/src/lib/errors.ts` — `export function getErrorMessage(err: unknown, fallback: string): string` (replaces 46 inline ternaries).
- Test: `frontend/src/lib/__tests__/use-api-query.test.tsx` (behavioral: resolves data, sets error message, ignores stale resolution after deps change/unmount, reload refetches).

**Interfaces produced:** `ApiError`, `useApiQuery`, `getErrorMessage` — all later tasks consume these.

**Steps:** TDD the hook (failing test → implement → pass), migrate `apiFetch` to throw `ApiError`, update `api.test.ts` expectations, commit.

### Task 5: Split `lib/api.ts` into domain modules

**Files:**
- Create: `frontend/src/lib/api/{auth,collections,pipelines,chat,models}.ts` + `frontend/src/lib/api/index.ts` barrel; `chat.ts` includes `streamChat` SSE parsing.
- Modify: `frontend/src/lib/api.ts` → delete; repoint the barrel so `@/lib/api` resolves (rename dir import).
- Normalize signatures: token is always the **first** parameter of every authed function.
- Remove `"use client"` from lib modules.

**Steps:** move functions verbatim, update the ~30 importers, typecheck+test green, commit.

### Task 6: Split `lib/types.ts` into domain files

**Files:**
- Create: `frontend/src/lib/types/{common,collections,chat,pipelines,traces}.ts` + barrel `frontend/src/lib/types/index.ts`; delete `lib/types.ts`.
- Dedupe: `ParameterInputKind` (chat-parameters) vs `ParameterInputType` (parameter-controls) → single type in `lib/types/common.ts`; fold `ToolStreamEvent` into the `ChatStreamEvent` union variants.

**Steps:** move, dedupe, typecheck+test green, commit.

### Task 7: UI primitives

**Files:**
- Create: `frontend/src/components/ui/modal-overlay.tsx` — `ModalOverlay({ open, onClose, labelledBy?, children, backdropClassName? })`: fixed overlay, `role="dialog" aria-modal`, Escape-to-close, backdrop click, initial-focus + focus restore, scroll lock.
- Create: `frontend/src/components/ui/field.tsx` — `Field` (label+id wiring, hint/error slot), `TextInput`, `Select`, `TextArea` sharing the one input class string.
- Modify: `frontend/src/components/ui/confirm-dialog.tsx` — rebase on `ModalOverlay`; add optional `confirmText` (type-to-confirm) prop.
- Modify: `frontend/src/components/ui/wizard-shell.tsx` — rebase on `ModalOverlay` (gains Escape + a11y); add shared `WizardFooter` (Back/Next/Create cluster used identically by both wizards).
- Modify: `frontend/src/components/ui/button.tsx` — `loading` keeps children, adds spinner + `aria-busy`, no layout jump.
- Modify: `frontend/src/lib/utils.ts` — `cn` delegates to `tailwind-merge` (add dep) so class conflicts resolve deterministically.
- Tests: behavioral tests for ModalOverlay (Escape, backdrop, focus restore) and Field label association.

**Steps:** TDD primitives, migrate ConfirmDialog/WizardShell, replace the ~29 copies of the raw input class string across pages/components with `TextInput`/`Select`/`TextArea`, commit.

### Task 8: Kill cross-file duplication

**Files:**
- Create: `frontend/src/lib/format.ts` — move `formatPricePerMillion` (62-line verbatim dup in ProviderRoutingCard + ModelSelectorCard), `formatLatency` (dup CollectionOverview/CollectionsList), reuse existing `truncate` from utils in PipelineNode.
- Modify: `components/pipelines/pipeline-config.ts` — add `coerceFieldValue(field, raw)` + `getInputValue(field, config)`; delete the copies in PipelineInspector and PipelineOverridesEditor; single `formatConfigValue` (null → `"—"` consistently).
- Modify: `components/pipelines/pipeline-utils.ts` — add `specToNodeData(spec)`, `sortIndexesByName(indexes)`; export `CREATE_SENTINEL = "__create__"` from `pipeline-kinds.ts` or constants module; memoize PipelineInspector's sort.
- Modify: `components/pipelines/EmbeddingModelSelectorCard.tsx` — own its filter/search/sort state internally (new `useEmbeddingModelFilter(models)`), dropping the triplicated filter pipeline and shrinking its 10-prop surface.
- Extract shared stats-card row used by CollectionOverview/CollectionsList into `components/collections/CollectionStats.tsx`.
- Chat-studio dups: single `chipClass` export, single `CHAT_INPUT_MIN/MAX_HEIGHT` + `DEFAULT_STREAMING_ENABLED` in `chat-constants.ts`, one `makeToolId()` helper, one live-state reset (falls out of Task 9's reducer).
- Move UmapCanvas's luma prototype patch to `components/collections/detail/visualize/luma-patches.ts` imported once.

**Steps:** extract, replace usages, typecheck+test green, commit.

### Task 9: Decompose ChatStudio (3,143 → orchestrator + hooks)

**Files:**
- Create under `frontend/src/components/chat-studio/hooks/`:
  - `use-chat-session-routing.ts` — activeSessionId, buildChatUrl/navigateToChat, the 4 URL-sync effects.
  - `use-run-settings-order.ts` — order state + debounced profile persist.
  - `use-model-catalog.ts` — catalog fetch (via useApiQuery), search/sort, `currentModelInfo`, `supportedParameterKeys`, `providerModelSlug`.
  - `use-model-parameters.ts` — overrides + handlers + `buildParameterPayload`; expose one grouped object.
  - `use-provider-preferences.ts` — provider form, payload memo, endpoint directory fetch.
  - `use-prompt-editor.ts` — 8 prompt states, prompt fetches, preview memos, handlers.
  - `use-collection-tools.ts` — collections fetch, selection, documentCount, contextWindow.
  - `use-auto-scroll.ts` — scroll refs/handlers/effects.
  - `use-session-history-polling.ts` — poll start/stop.
  - `use-chat-stream.ts` — **useReducer** replacing the 16 live-stream states + 6 mirror refs; actions incl. `RESET` (removes the 3× copy-pasted reset block), `TOKEN`, `TOOL_EVENT`, `REASONING_*`, `FINALIZE`.
- Modify: `chat-helpers.ts` — add pure `buildChatEntries(...)` (the 136-line memo body) and `buildProviderPayload(...)`.
- Modify: `ChatStudio.tsx` — becomes an orchestrator composing the hooks; `chatEntryOrder` derived, not state; mutation flow (`handleSend`/`performChatMutation`/`applyChatResponse`) dispatches reducer actions instead of 20 `setX` calls.
- Modify: `telemetry/TelemetryPanel.tsx` — collapse ~78 props into grouped objects (`model`, `parameters`, `provider`, `prompts`, `streaming`, `usage`, `order`); import `markdownComponents` where used instead of threading it.
- Fix along the way: hydration-unsafe initializers (`usePersistentToggle`, sessionStorage/`window.innerWidth` reads) move to post-mount effects; stale `isPendingSession` memo; impure `ensureMessageOrder` inside `setMessages` updater; wrap `ChatTimeline`/`HistoryPanel`/`TelemetryPanel` in `React.memo` with stable props.

**Target:** ChatStudio.tsx ≤ ~400 lines; every hook ≤ ~250 lines.

**Steps:** extract hooks one at a time, typecheck+test after each, update chat-studio tests as behavior allows (Task 12 does the big test overhaul), commit per extraction batch.

### Task 10: Decompose PipelineBuilder + IndexManagerModal

**Files:**
- Create `components/pipelines/hooks/`: `use-pipelines.ts` (CRUD/save/delete/versions), `use-embedding-model-catalog.ts`, `use-pinecone-indexes.ts` (single fetch path — kills the duplicated refresh/load pair), `use-canvas-drag-drop.ts`.
- Create: `components/pipelines/PipelineModals.tsx` (ConfirmDialog + wizard + index-manager orchestration incl. `returnToPipelineWizard` handshake).
- Split `index-manager/IndexManagerModal.tsx` into `IndexListPanel.tsx`, `IndexDetailsPanel.tsx`, `CreateIndexForm.tsx` (+`use-create-index-form.ts`), delete bespoke nested delete modal in favor of `ConfirmDialog confirmText`; fix the viewMode-reset-on-refresh effect bug; rebase on `ModalOverlay`.

**Target:** PipelineBuilder ≤ ~300 lines; each new file ≤ ~250.

### Task 11: Split PipelineTraceViewer + collections/dashboard cleanup

**Files:**
- Create: `components/traces/trace-payload-utils.ts` (pure: `containsChunkId`, `buildPreviewPayload`, `resolveTextSummary`, `renderScalarValue`, geometry helpers) + unit tests.
- Create: `components/traces/use-trace-playback.ts`, `TraceSummaryBlock.tsx`, `TracePayloadBlock.tsx`, `TraceIOColumn.tsx` (kills the ~110-line inputs/outputs twin).
- Modify: `PipelineTraceViewer.tsx` → thin composition on `ModalOverlay`; accept optional `nodeSpecs` prop / use `useAuth()` instead of drilled token.
- Modify: `collections/list/CreateCollectionWizard.tsx` — replace the self-writing overrides effect with seed-on-expand in the click handler; collapse the overlapping default-sync effects; use `WizardFooter`.
- Modify: `app/(console)/dashboard/page.tsx` — extract `use-dashboard-data.ts`; batch document counts with `Promise.all` (no serial N+1); page becomes thin.
- Modify: `app/(console)/settings/page.tsx` — extract form sections into `components/settings/`.
- Modify: `chunks/ChunkPreviewOverlay.tsx` — rebase on ModalOverlay, drop trivial memo, sync `defaultRenderMode` via prop.

### Task 12: Test overhaul

**Files:**
- Create: `frontend/src/test/mocks.ts` — `mockApi(overrides)` factory replacing the 17 hand-rolled `vi.mock("@/lib/api")` shims; `mockAuth(user?)` for the 10 auth re-mocks.
- Create: `frontend/src/test/fixtures/` — shared Collection/Document/Pipeline/Session builders (move chat-studio fixtures here or re-export).
- Delete: `components/chat-studio/__tests__/index.test.ts`, `components/pipelines/__tests__/index.test.ts` (re-export padding); the prop-capture callback-invocation blocks in `ChatStudio.test.tsx` (e.g. the 15-callback `act()` with no outcome assertions, `toEqual(expect.any(Object))` assertions); class-name `querySelector` assertions where a role/text query exists.
- Rewrite: chat-studio container tests → smaller behavior tests per extracted hook (`renderHook`) + one integration-ish ChatStudio test with real children where feasible.
- Modify: `vitest.config.ts` — thresholds to lines 70 / functions 70 / statements 70 / branches 60.
- Convert high-value interaction tests from `fireEvent` to `user-event` where keyboard/focus semantics matter (ModalOverlay, wizards).

### Task 13: Lint/TS enforcement

**Files:**
- Modify: `frontend/eslint.config.mjs` —
  - `max-lines: ["error", { max: 400, skipBlankLines: true, skipComments: true }]` (override off for `**/__tests__/**`),
  - `no-console: ["error", { allow: ["warn", "error"] }]`,
  - `complexity: ["warn", 15]`, `max-depth: ["warn", 4]`,
  - `react-hooks/exhaustive-deps: "error"`,
  - `import/no-duplicates`, keep sonarjs recommended.
- Modify: `frontend/tsconfig.json` — add `"noUncheckedIndexedAccess": true` if fixable within the phase, else document as follow-up in AGENTS.md.
- Ensure `npm run lint` green across refactored tree.

### Task 14: `frontend/AGENTS.md`

Write best-practice rules derived 1:1 from every issue class found & fixed: file-size and component-driven structure, hooks-own-state pattern, no derived-state-in-state, reducer threshold, shared primitives usage (ModalOverlay/Field/Button), useApiQuery for all data loads, getErrorMessage, typed ApiError, token/param conventions, no console.*, hydration-safe initializers, duplication rule ("second copy = extract"), a11y checklist for modals/inputs, testing philosophy (behavior over wiring, what to never write, user-event, central mocks/fixtures, coverage is a floor not a goal), typecheck/lint gates, types organization.

### Task 15: Final verification

- [ ] `npm run typecheck` → 0 errors.
- [ ] `npm run lint` → 0 errors.
- [ ] `npx vitest run` → all pass.
- [ ] `npm run build` → succeeds.
- [ ] Line-count audit: `find src -name '*.tsx' -not -path '*__tests__*' | xargs wc -l | sort -rn | head` — nothing over 400.
- [ ] Commit; summary of before/after metrics.
