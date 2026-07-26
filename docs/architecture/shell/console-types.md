---
doc: shell/console-types
description: Shared client types/constants (teacher.ts) plus the APOLLO_ONLY deployment flag (flags.ts), extracted to lib/ to break a page↔component import cycle.
owns:
  - app/lib/teacher.ts
  - app/lib/flags.ts
related: [shell/console-orchestrator, sections/materials, sections/ai-tuning, sections/invites]
last_verified: 2026-07-25
stub: false
---

# console-types — app/lib/teacher.ts + flags.ts

`lib/` exists so `page.tsx` and the section components share these without a
page↔component import cycle. (Corrects the old "`lib/auth.ts` is the only lib
module" claim — there are three lib modules.)

## Interface

**teacher.ts** — the shared hub:
- Consts: `WEEK_KINDS` (`notes`/`slides`), `RESOURCE_WEIGHT_LABELS`
  (`textbook`/`slides`/`notes`), `MAX_WEEKS` (16), `POLL_INTERVAL_MS` (4000);
  predicate `isPendingStatus` (queued|processing).
- Types: `WeekKind`, `WeightKind`, `UploadStatus`, `ClassOption`,
  `UploadSummary`, `SectionState`, `WeekState`, `CourseState` (includes a
  course-wide `textbook: SectionState`), `RetrievalWeights`,
  `RetrievalWeightResponse`, `InviteLink`.

**flags.ts** — `APOLLO_ONLY`, parsed truthy from `NEXT_PUBLIC_APOLLO_ONLY`.

## Data flow

Imported by `console-orchestrator` (all types + both consts + `APOLLO_ONLY`) and
by `sections/materials`, `sections/ai-tuning`, `sections/invites`
(`InviteLink`). `APOLLO_ONLY` filters `SECTIONS` in `page.tsx` to hide the
Hoot-only `ai-tuning` + `reports` sections.

## Invariants & gotchas

- `CourseState.textbook` is always present from the API — the course-wide
  material, not pinned to a week.
- `RetrievalWeights` is keyed by `WeightKind`; only `textbook`/`slides`/`notes`
  are teacher-editable (the AI-tuning sliders).

## Env flags

- `APOLLO_ONLY` (`NEXT_PUBLIC_APOLLO_ONLY`) — build-time inlined, per Railway
  service (pilot prod on, staging off). Names the flag only; value is volatile.

## Related

- Consumer: [console-orchestrator](console-orchestrator.md); flag effect drives
  the [sections/_index](../sections/_index.md) visibility.
