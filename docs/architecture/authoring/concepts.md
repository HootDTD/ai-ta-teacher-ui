---
doc: authoring/concepts
description: ConceptsPanel — self-fetching concept CRUD plus the variant-generation launcher that seeds and starts an Apollo problem-generation run.
owns:
  - app/components/ConceptsPanel.tsx
related: [authoring/generated-problems, api/concepts, api/problem-generation, shell/console-orchestrator]
last_verified: 2026-07-25
stub: false
---

# concepts — ConceptsPanel

Self-fetching (~547 lines, default export). Props: `searchSpaceId`,
`accessToken`, `onGoToGenerated?`. Concepts are the topics students teach back;
uploaded problem sets are matched against this list.

## Interface

Types `ConceptSummary` (id, slug, display_name, description, problem_count,
`has_teachable_problems`, timestamps) and `GenerationSeed`
(`concept_problem_id`, problem_text, difficulty). Consts `GENERATION_UNAVAILABLE`
(404 copy) / `GENERATION_DISABLED` (403 copy). Local `authHeaders` builds the
`Bearer` header inline.

## Data flow

- **CRUD:** `GET /api/teacher/concepts?search_space_id=` (list), `POST` (create),
  `PATCH` / `DELETE /api/teacher/concepts/{id}` (edit / delete-with-confirm).
  Delete is blocked while `problem_count > 0`.
- **Generation launcher:** expanding "Generate variants" `GET`s tier-2 seeds
  (`/problem-generation/concepts/{id}/seeds`); the teacher selects seed ids +
  a count `1..10`; `POST /problem-generation/concepts/{id}/variants` starts a run,
  then `onGoToGenerated()` jumps to the Generated Problems section.

## Invariants & gotchas

- Resets all local state on `searchSpaceId` change.
- "Generate variants" only appears when `concept.has_teachable_problems`.
- 404 on seeds ⇒ `unavailable` message; 403 on variants ⇒ `disabled` message;
  handled locally, not thrown.

## Related

- Backend proxies: [api/concepts](../api/concepts.md),
  [api/problem-generation](../api/problem-generation.md).
- Jump target: [generated-problems](generated-problems.md).
