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
};
