---
doc: authoring/generated-problems
description: GeneratedProblemsPanel — reviews AI-generated variant runs (round-trip + qualitative checks, cost/drop metadata), approves reference solutions, and edits problems.
owns:
  - app/components/GeneratedProblemsPanel.tsx
related: [authoring/concepts, authoring/problem-sets, api/problem-generation, api/authored-sets]
last_verified: 2026-07-25
stub: false
---

# generated-problems — GeneratedProblemsPanel

Self-fetching (~867 lines, default export). Props: `searchSpaceId`,
`accessToken`, `onGoToConcepts`. Lists generation runs and polls non-terminal
(`pending|running`) rows every 4s.

## Interface

Types: `RunStatus`, `GenerationRun` / `RunDetail` (with `ingest_run` cost:
`llm_calls`, tokens, `llm_cost_usd` string), `ReferenceStep`, `GeneratedProblem`
(with `review.round_trip.verdict` `verified|unresolved|inapplicable` +
`qualitative_rubric`), `ProblemEditRequest` / `EditedProblemResponse`,
`ProblemEditOverlay`, `ApproveState`. Helpers `droppedTotal`, `createdAtLabel`,
`readErrorDetail`, `NON_TERMINAL`. Sub-components: `RunStatusBadge`,
`GeneratedProblemCard`, `RoundTripBadge`, `QualitativeRubric`,
`ReferenceSolutionPreview`, `GeneratedProblemEditFields`.

## Data flow

- **List / detail:** `GET /api/teacher/problem-generation/runs?search_space_id=`;
  on expand `GET .../runs/{run_id}?full_text=1` (lazy).
- **Approve:** `POST .../problem-generation/problems/{id}/approve` with
  `{reference:'ocr'}`.
- **Edit** (pencil): `PATCH /api/teacher/problems/{id}` — the **same** flow as
  problem-sets, with duplicated helpers.

Each card shows provenance (variation operator, model), the round-trip +
qualitative-rubric checks, and run-level cost / drop metadata.

## Invariants & gotchas

- **Approve success depends on the `promoted` field, not HTTP 200.** A `409`
  is treated as already-approved (idempotent) and refreshes; otherwise
  `promoted:false` surfaces "Could not promote: …".
- 404 on the runs/generation endpoint ⇒ quiet "unavailable" state; 403 ⇒
  deployment-disabled copy.
- Edit-flow helpers/types are **copy-pasted** from
  [problem-sets](problem-sets.md) — a documented refactor candidate.

## Related

- Runs originate from [concepts](concepts.md)'s launcher.
- Proxies: [api/problem-generation](../api/problem-generation.md); shared PATCH
  owner [api/authored-sets](../api/authored-sets.md).
