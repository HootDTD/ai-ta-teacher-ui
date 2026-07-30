---
doc: authoring/_index
description: Router for the self-fetching Apollo problem-authoring panels (Concepts, Problem Sets, Generated Problems) that own their own fetch/poll/edit state.
owns: []
related: [shell/console-orchestrator]
last_verified: 2026-07-25
stub: false
---

# authoring — self-fetching Apollo panels

The three problem-authoring panels rendered inside the console. Unlike
[sections/](../sections/_index.md), these take only `searchSpaceId` +
`accessToken` and own their own state — they build `Bearer` headers inline and
call `/api/teacher/**` directly.

| Leaf | One-liner | Owns |
|---|---|---|
| [concepts](concepts.md) | concept CRUD + the variant-generation launcher | `app/components/ConceptsPanel.tsx` |
| [problem-sets](problem-sets.md) | PDF/manual authored-set upload, review, approve, edit | `app/components/AuthoredSetsPanel.tsx` |
| [generated-problems](generated-problems.md) | AI variant-run review, round-trip/rubric checks, approve, edit | `app/components/GeneratedProblemsPanel.tsx` |

## Cross-cutting invariants

- **Self-fetching contract.** Each panel resets and reloads on `searchSpaceId`
  change and polls its own non-terminal rows every `4s`. Keep fetch state inside
  the panel, not in the orchestrator.
- **Shared edit endpoint, duplicated helpers.** `problem-sets` and
  `generated-problems` both edit a problem via
  `PATCH /api/teacher/problems/{id}` (owned by
  [api/authored-sets](../api/authored-sets.md)). The edit-flow helpers/types
  (`stepContentText`, `cloneReferenceSteps`, `ReferenceStep`,
  `ProblemEditRequest` / `EditedProblemResponse`, `ReferenceSolutionPreview`,
  `*EditFields`) are **copy-pasted** across the two panels — a documented
  duplication / refactor candidate, not a shared module. If ever extracted to
  `lib/`, add a new leaf to own it.
- **Approve ≠ HTTP 200.** For both approve flows, promotion depends on the
  response `promoted` field; a 200 with `promoted:false` is surfaced as an error.
- **Cross-navigation.** Panels flip `page.tsx` `activeSection` via
  `onGoToConcepts` / `onGoToGenerated` callbacks.
