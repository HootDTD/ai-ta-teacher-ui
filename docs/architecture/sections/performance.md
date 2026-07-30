---
doc: sections/performance
description: ClassPerformanceSection — self-fetching class-performance panel (roster tiles, grade distribution, activity, rubric-loss bars, concept + student tables) over the backend classroom-performance endpoint.
owns:
  - app/components/ClassPerformanceSection.tsx
related: [sections/_index, api/classroom, shell/console-orchestrator]
last_verified: 2026-07-30
stub: false
---

# performance — ClassPerformanceSection

The teacher's always-on view of Apollo teaching results. **The one
self-fetching section** (documented exception to the sections-are-dumb
invariant — it owns a polling loop, so pushing its state up into the
orchestrator would drag a timer and a large payload type into `page.tsx` for
no reuse).

## Interface

Props: `{ searchSpaceId: number | null; accessToken: string | null }` — same
minimal contract as the self-fetching authoring panels.

## Data flow

On mount / class change: `GET /api/teacher/classroom/{searchSpaceId}/performance`
(Bearer) → `PerformancePayload` (typed mirror of
`apollo/projections/performance.py`'s payload; grades are best-attempt-wins
per (student, problem) carrying the SERVED letter, so the teacher sees
exactly what the student saw). Re-fetches on a 60s `setInterval`
(`POLL_INTERVAL_MS`, background — no spinner) plus a manual Refresh button;
the interval is torn down on unmount and rebuilt when class or token changes.

Rendered blocks: stat tiles (enrolled/active, attempts/graded, class average,
not-started), grade-distribution bars (every letter band, zero buckets
included), stacked graded/in-progress activity-by-day bars, rubric-axis
"where the class loses points" bars, concept rollup table, and the student
table (name = `full_name || email || short user id`; letter pills via
`teacher-pill--success` for A-band, `--danger` for D/F, `--neutral` between).

## Non-obvious conventions

- Errors surface the FastAPI `{ detail }` when parseable, else the HTTP
  status — same convention as the orchestrator's fetches.
- Charts are plain CSS bars on design tokens (`--accent`, `--accent-soft`,
  `--border`, `--pill-bg`) — no chart library.
- Empty states are per-block ("No attempts yet") so a pre-class course
  renders a meaningful, non-broken panel.
