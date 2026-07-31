import { bandForScore, CHART_COLOR_VAR } from './utils';
import type { PerformancePayload } from './types';

const RUBRIC_LABELS: Record<keyof PerformancePayload['rubric_averages'], string> = {
  procedure: 'Procedure',
  justification: 'Justification',
  simplification: 'Simplification',
};

// Full-width compact strip: the 3 rubric axes sit side by side in one row
// instead of stacking, so this card is only ever as tall as its own content
// (a header + one bar row) — never stretched to match a taller neighbor.
export default function RubricLossBars({ averages }: { averages: PerformancePayload['rubric_averages'] }) {
  const allNull = Object.values(averages).every((v) => v === null);

  return (
    <div className="rounded-3xl teacher-panel-soft p-5 space-y-3">
      <div>
        <h2 className="text-lg font-semibold teacher-section-title">Where the class loses points</h2>
        <p className="text-xs teacher-muted">Average rubric score across all graded attempts</p>
      </div>
      {allNull ? (
        <p className="text-sm teacher-muted">No graded attempts yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {(Object.keys(RUBRIC_LABELS) as (keyof typeof RUBRIC_LABELS)[]).map((key) => {
            const value = averages[key];
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm teacher-muted">{RUBRIC_LABELS[key]}</span>
                  <span className="text-xs teacher-value tabular-nums">
                    {value !== null ? Math.round(value) : '—'}
                  </span>
                </div>
                <div className="h-3 rounded" style={{ background: 'var(--pill-bg)' }}>
                  <div
                    className="h-3 rounded"
                    style={{ background: CHART_COLOR_VAR[bandForScore(value)], width: `${value ?? 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
