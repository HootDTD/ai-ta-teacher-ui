import type { AttentionFlag, PerformancePayload, StudentRow } from './types';

// Mirrors apollo/overseer/rubric.py LETTER_BANDS ordering (A+ down to F).
export const LETTER_ORDER = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F'];

// Mirrors apollo/projections/performance_insights.py MIN_CORRELATION_N — insights
// blocks go null below this student count; kept here only for empty-state copy.
export const MIN_CORRELATION_N = 8;

export type GradeBand = 'green' | 'blue' | 'red';

// Color semantics (design spec section "Color system"): green = strong/positive
// (A-band), blue = informational/mid, red = attention (D/F). Never hardcode hex
// in components — always resolve through CHART_COLOR_VAR.
export const CHART_COLOR_VAR: Record<GradeBand, string> = {
  green: 'var(--chart-green)',
  blue: 'var(--chart-blue)',
  red: 'var(--chart-red)',
};

export function bandForLetter(letter: string | null | undefined): GradeBand {
  if (!letter) return 'blue';
  if (letter.startsWith('A')) return 'green';
  if (letter === 'D' || letter === 'F') return 'red';
  return 'blue';
}

// Same A-/D-F thresholds as the letter bands (85 = A-, 60 = C), for values that
// only carry a numeric score (e.g. rubric axes, effort quartiles).
export function bandForScore(score: number | null | undefined): GradeBand {
  if (score === null || score === undefined) return 'blue';
  if (score >= 85) return 'green';
  if (score < 60) return 'red';
  return 'blue';
}

export function letterPillClass(letter: string): string {
  if (letter.startsWith('A')) return 'teacher-pill teacher-pill--success';
  if (letter === 'F' || letter === 'D') return 'teacher-pill teacher-pill--danger';
  return 'teacher-pill teacher-pill--neutral';
}

// v2: email IS the student's name in the table — no separate name/email pair,
// no full_name fallback (full_name stays in the contract but is unused here).
export function studentLabel(s: Pick<StudentRow, 'email' | 'user_id'>): string {
  return s.email ?? `Student ${s.user_id.slice(0, 8)}`;
}

// Enrolled students who never signed in and never started an Apollo attempt.
export function notStartedCount(
  roster: PerformancePayload['roster'],
  totals: PerformancePayload['totals'],
): number {
  return Math.max(0, roster.students - totals.active_students - totals.signed_in_only);
}

// Short, non-truncating x-axis tick for ActivityByDay: day-of-month alone
// ("22") reads unambiguously once the month is established, so the month
// only spells out at the first tick or wherever it rolls over ("Jul 22")
// mid-range. Keeps every ordinary tick to 1-2 characters so 10+ bars stay
// readable without ellipsis-truncating the label (see dataviz skill review).
export function formatDayTick(day: string, prevDay: string | null): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  const dayOfMonth = d.getUTCDate();
  const prev = prevDay ? new Date(`${prevDay}T00:00:00Z`) : null;
  const showMonth =
    !prev || Number.isNaN(prev.getTime()) || prev.getUTCMonth() !== d.getUTCMonth() || prev.getUTCFullYear() !== d.getUTCFullYear();
  if (!showMonth) return String(dayOfMonth);
  const month = d.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
  return `${month} ${dayOfMonth}`;
}

// Deploy-order tolerance: the backend and this UI deploy at different moments,
// so a v1 payload (no problems/insights blocks, students without
// engagement/flags) must render as empty states — never crash the tab. v2.1
// adds problem_text/students/nodes to each problems[] row; a v2-only payload
// (problems present, new fields absent) must render those as empty text/[]
// rather than crash — same deploy-skew tolerance, one field-set deeper.
//
// P3.3 adds a third skew layer: insights.retry_timing, per-(student, problem)
// attempts/median_gap_seconds, and nodes[].unprobed. A backend that predates
// P3.3 omits all four; each gets a default here so no component ever sees
// undefined (which would render NaN through Math.round or a bare "undefined"
// in a template literal).
export function normalizePayload(raw: PerformancePayload): PerformancePayload {
  return {
    ...raw,
    problems: (raw.problems ?? []).map((p) => ({
      ...p,
      problem_text: p.problem_text ?? '',
      students: (p.students ?? []).map((s) => ({
        ...s,
        attempts: s.attempts ?? 0,
        median_gap_seconds: s.median_gap_seconds ?? null,
      })),
      nodes: (p.nodes ?? []).map((n) => ({
        ...n,
        unprobed: n.unprobed ?? 0,
      })),
    })),
    insights: raw.insights
      ? { ...raw.insights, retry_timing: raw.insights.retry_timing ?? null }
      : { correlation: null, effort_quartiles: null, retry_payoff: null, retry_timing: null },
    students: (raw.students ?? []).map((s) => ({
      ...s,
      engagement:
        s.engagement ?? { teaching_turns: 0, median_words: null, problems_retried: 0, avg_gain: null },
      flags: s.flags ?? [],
    })),
  };
}

export function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatScore(score: number | null | undefined): string {
  return score !== null && score !== undefined ? Math.round(score).toString() : '—';
}

export function formatSigned(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const rounded = Math.round(n * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

// A DURATION between two attempts, not an absolute timestamp (formatWhen does
// those). One unit only, rounded to nearest, so the value stays 2-3 characters
// inside a table cell: "42s" / "12m" / "5h" / "3d". null — no second graded
// attempt, or a pre-P3.3 backend — reads as the same em dash every other
// absent value uses. A gap within half a unit of a bucket edge renders as
// "60s"/"60m" rather than cascading to the next unit; that is the literal
// bucket contract and these numbers are display-only.
export function formatGap(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, seconds);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

// Labels are kept to one short word/token so the compact badge never wraps
// inside the Student-table Flags column — full detail rides the tooltip.
export const FLAG_META: Record<AttentionFlag, { label: string; title: string }> = {
  not_started: { label: 'New', title: 'Signed in to the course but has no Apollo attempts yet' },
  low_effort: {
    label: 'Brief',
    title: 'Three or more teaching turns averaging under 8 words — one-liner explanations',
  },
  gave_up: {
    label: 'Gave up',
    title: 'Best graded score under 60 with no further attempt after it',
  },
  grinding: {
    label: 'Grinding',
    title: 'Three or more graded attempts on a problem with little to no score improvement',
  },
  rapid_retry: {
    label: 'Fast retry',
    title:
      'Retried a problem within 5 minutes and jumped at least one letter band — read the transcript before trusting the higher grade',
  },
};
