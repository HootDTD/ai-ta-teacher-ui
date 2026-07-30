---
doc: authoring/problem-sets
description: AuthoredSetsPanel — the largest authoring panel; uploads paired-PDF and manually-typed problem sets, polls provisioning, and reviews/approves/edits each extracted problem.
owns:
  - app/components/AuthoredSetsPanel.tsx
related: [authoring/concepts, authoring/generated-problems, api/authored-sets]
last_verified: 2026-07-25
stub: false
---

# problem-sets — AuthoredSetsPanel

Self-fetching (~1128 lines, the largest component; default export). Props:
`searchSpaceId`, `accessToken`, `onGoToConcepts`. Lists PDF-uploaded and
manually-typed sets and polls non-terminal rows every 4s.

## Interface

Types: `AuthoredStatus` (`pending|indexing|provisioning|done|failed`),
`AuthoredSetSummary` / `AuthoredSetDetail`, `ReferenceStep` (typed step with
`entry_type`, `content`, `depends_on`), `ReviewDraft`, `ProblemReview`
(whitelisted projection of `provenance.authored_review`), `AuthoredProblemResult`
(outcome `promoted|rejected|held_for_review`), `ManualAuthoredSetRequest` /
`Response`, `ProblemEditRequest` / `EditedProblemResponse`, `ApproveState`.
Helpers: `holdReasonLabel`, `effectiveOutcome`, `readErrorDetail`,
`NON_TERMINAL` / `isNonTerminal`. Sub-components: `FilePicker`, `DraftPreview`,
`ReferenceSolutionPreview`, `QuestionText`, `ProblemEditFields`, `ProblemRow`,
`StatusBadge`.

## Data flow

- **List / detail:** `GET /api/teacher/authored-sets?search_space_id=`; on expand
  `GET /api/teacher/authored-sets/{set_id}?full_text=1` (untruncated).
- **Create:** `POST /api/teacher/authored-sets` (paired problem+solution PDFs,
  multipart; solution optional) or `POST .../authored-sets/manual` (typed JSON
  `{problem_text, solution_text?}`).
- **Approve** held cards: `POST .../authored-sets/{set_id}/problems/{id}/approve`
  with `{reference:'ocr'|'generated'}`, then an authoritative `fetchDetail`.
- **Edit** (pencil): `PATCH /api/teacher/problems/{id}` — question text +
  string-valued reference-step `content` only, preserving step ids/types/order.
- **Delete:** `DELETE /api/teacher/authored-sets/{set_id}`.

## Invariants & gotchas

- **A 200 does NOT mean promoted.** Approve-time gates can return
  `{promoted:false, diagnostic}`; the panel throws "Could not promote: …" rather
  than silently leaving the card unchanged.
- `effectiveOutcome` reconciles optimistic `ApproveState` with the refetched
  `review.required` flag (flips false on approval).
- Rejected legacy rows stay readable when newer payload fields are absent.
- The edit-flow helpers/types here are **duplicated** in
  [generated-problems](generated-problems.md) (refactor candidate).

## Related

- Shared PATCH endpoint (owner): [api/authored-sets](../api/authored-sets.md).
- Concepts the sets match against: [concepts](concepts.md).
