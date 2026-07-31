---
doc: sections/performance
description: ClassPerformanceSection — self-fetching class-performance panel (v2.1 — stat tiles, grade distribution with letter drill-down, problems-by-concept with per-problem expand (text + node breakdown + student list), activity, rubric-loss bars, algorithmic engagement insights, student table) over the backend classroom-performance endpoint.
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
last_verified: 2026-07-31
stub: false
---

# performance — ClassPerformanceSection (v2.1)

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
`apollo/projections/performance.py` + `performance_insights.py`'s v2.1
payload; grades are best-attempt-wins per (student, problem) carrying the
SERVED letter, so the teacher sees exactly what the student saw). Re-fetches
on a 60s `setInterval` (`POLL_INTERVAL_MS`, background — no spinner) plus a
manual Refresh button; the interval is torn down on unmount and rebuilt when
class or token changes. Responses pass through `normalizePayload` (`utils.ts`):
a v1 payload (no `problems`/`insights`/`engagement`/`flags`) renders as empty
states, not a crash, and — one field-set deeper — a v2-only payload (`problems`
present but each row missing the v2.1 `problem_text`/`students`/`nodes`
fields) defaults those to `''`/`[]`/`[]` per row, so both the older and the
current backend deploy skew are tolerated without a crash.

Rendered blocks, each its own component: `StatTiles` (enrolled/active,
attempts/graded, class average, not-started), `GradeDistribution` (every
letter band, zero buckets included; `count > 0` bars are buttons that open an
in-page drill-down panel listing every problem with a best-grade at that
letter + the students there — client-side join over `problems[].students`,
falling back to `students[].best_grades` for a v2-only backend), and
`ProblemsByConcept` (concept group headers; per-problem row is a button
showing the `problem_text` snippet — 1-2 line clamp, `title` attr for the
full text, never the opaque `problem_code` — plus the distribution mini-bar +
avg + n; expands to the full text (plain text, line breaks preserved — no
math/markdown renderer in this repo), a per-node understood/partial/missed
breakdown, and the per-student grade list; supersedes the v1 concept-rollup
table). Then `ActivityByDay` (stacked graded/in-progress bars; x-axis ticks
via `formatDayTick` — day-of-month alone, month spelled out only at the
first tick or a rollover, so 10+ bars never truncate), `RubricLossBars` (3
axes, `misconception_corrected` removed; a compact full-width strip), and
`EngagementInsights` (algorithmic-only: teaching-turns-vs-grade scatter with
real axis titles + Pearson r / Spearman ρ / n, plus effort-quartile bars +
retry-payoff strip; quartile `label` text rendered verbatim, never
hardcoded; no LLM/Neo4j calls). `StudentTable` (label =
`email ?? "Student " + id8`; default sort avg grade DESC via header toggle,
null averages always last; compact flag badges with tooltips) closes the
section.

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
- Both v2.1 drill-downs are plain `<button>` toggles with `aria-expanded` +
  `aria-controls` — keyboard-operable for free, no routing. `ProblemsByConcept`
  tracks expand state per row (multiple can be open); `GradeDistribution`
  tracks one open letter (re-click or its Close button dismisses it). Node
  right/wrong bars reuse the same green/blue/red `CHART_COLOR_VAR` tokens as
  the rest of the section (understood/partial/missed), never a new palette.
