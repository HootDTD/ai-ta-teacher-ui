---
doc: sections/performance
description: ClassPerformanceSection — self-fetching class-performance panel (v2 — stat tiles, grade distribution, problems-by-concept, activity, rubric-loss bars, algorithmic engagement insights, student table) over the backend classroom-performance endpoint.
owns:
  - app/components/ClassPerformanceSection.tsx
  - app/components/performance/types.ts
  - app/components/performance/utils.ts
  - app/components/performance/StatTiles.tsx
  - app/components/performance/GradeDistribution.tsx
  - app/components/performance/ProblemsByConcept.tsx
  - app/components/performance/ActivityByDay.tsx
  - app/components/performance/EngagementInsights.tsx
  - app/components/performance/RubricLossBars.tsx
  - app/components/performance/StudentTable.tsx
related: [sections/_index, api/classroom, shell/console-orchestrator]
last_verified: 2026-07-30
stub: false
---

# performance — ClassPerformanceSection (v2)

The teacher's always-on view of Apollo teaching results. **The one
self-fetching section** (documented exception to the sections-are-dumb
invariant — it owns a polling loop, so pushing its state up into the
orchestrator would drag a timer and a large payload type into `page.tsx` for
no reuse). `ClassPerformanceSection.tsx` is now a thin orchestrator (fetch,
60s poll, error, layout only); every rendered block is a component under
`app/components/performance/`.

## Interface

Props: `{ searchSpaceId: number | null; accessToken: string | null }` — same
minimal contract as the self-fetching authoring panels.

## Data flow

On mount / class change: `GET /api/teacher/classroom/{searchSpaceId}/performance`
(Bearer) → `PerformancePayload` (typed mirror in `performance/types.ts` of
`apollo/projections/performance.py` + `performance_insights.py`'s v2 payload;
grades are best-attempt-wins per (student, problem) carrying the SERVED
letter, so the teacher sees exactly what the student saw). Re-fetches on a
60s `setInterval` (`POLL_INTERVAL_MS`, background — no spinner) plus a manual
Refresh button; the interval is torn down on unmount and rebuilt when class
or token changes. Responses pass through `normalizePayload`
(`performance/utils.ts`): a v1 payload (no `problems`/`insights`, students
without `engagement`/`flags`) renders as empty states, not a crash —
the section tolerates one payload version of deploy skew.

Rendered blocks, each its own component: `StatTiles` (enrolled/active,
attempts/graded, class average, not-started), `GradeDistribution` (every
letter band, zero buckets included, bars colored by grade band),
`ProblemsByConcept` (concept group headers, per-problem stacked
letter-distribution mini-bar + avg score + student count — supersedes the v1
concept-rollup table), `ActivityByDay` (stacked graded/in-progress bars;
x-axis ticks via `formatDayTick` — day-of-month alone ("22"), month spelled
out only at the first tick or on a month rollover ("Jul 22"), so 10+ bars
never truncate), `RubricLossBars` (3 axes — `misconception_corrected`
removed; a compact full-width strip, the 3 axes laid out side by side in one
bar row so the card is only ever as tall as its own content), and
`EngagementInsights` (algorithmic-only, full-width with an internal
responsive grid: the teaching-turns-vs-grade scatter on the left — roughly
2x the height of a standard inline chart, y ticks/faint `--border` gridlines
at 50/75/100, real "Teaching turns" / "Avg grade" axis titles, Pearson r /
Spearman ρ / n stated — and the effort-quartile bars + retry-payoff strip
stacked on the right; quartile `label` text is rendered verbatim from the
payload, never hardcoded; no LLM/Neo4j calls). `StudentTable` (label =
`email ?? "Student " + id8`, no separate email sub-line, no `full_name`
fallback and no XP/level column; default sort by avg grade DESC via a header
toggle, null averages always last; compact flag badges with `title`
tooltips) closes the section.

Shared label/color/format helpers (`studentLabel`, `letterPillClass`,
`bandForLetter`, `bandForScore`, `formatWhen`, `formatDayTick`,
`notStartedCount`, `FLAG_META`, …) live in `performance/utils.ts` so every
block computes grade-band color and date/label formatting the same way.

## Non-obvious conventions

- Errors surface the FastAPI `{ detail }` when parseable, else the HTTP
  status — same convention as the orchestrator's fetches.
- Charts are plain CSS bars / inline SVG on design tokens — no chart library.
  Grade-band color is always resolved through `--chart-green` / `--chart-blue`
  / `--chart-red` (defined in `globals.css`, both themes, validated with the
  dataviz skill's palette checker) — green = strong/positive (A-band,
  positive avg_gain, top quartile), blue = informational/mid, red = attention
  (D/F, flags, bottom quartile, negative gain); `--muted` stays reserved for
  in-progress/absent. Never hardcode a hex in a component.
- Empty states are per-block ("No attempts yet", "Not enough data yet" below
  the `MIN_CORRELATION_N` threshold) so a pre-class course renders a
  meaningful, non-broken panel.
- The v2 payload still returns the old per-concept `concepts` rollup
  unchanged (other consumers depend on it), but this UI intentionally no
  longer renders it — `ProblemsByConcept` subsumes it with per-problem
  detail.
- `RubricLossBars` and `EngagementInsights` render as two standalone
  full-width blocks (not a 2-col grid) — pairing a 3-bar-tall card against a
  scatter-chart card forced equal height and left most of the shorter card
  empty. Chart gridlines/axis lines stay `--border` (recessive); axis titles
  and tick text stay `--muted` at minimum, never fainter, in both themes.
