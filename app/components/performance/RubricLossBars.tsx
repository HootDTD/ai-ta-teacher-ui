import { bandForScore, CHART_COLOR_VAR } from './utils';
import type { PerformancePayload } from './types';

const RUBRIC_LABELS: Record<keyof PerformancePayload['rubric_averages'], string> = {
  procedure: 'Procedure',
  justification: 'Justification',
  simplification: 'Simplification',
};

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
        <div className="space-y-2">
          {(Object.keys(RUBRIC_LABELS) as (keyof typeof RUBRIC_LABELS)[]).map((key) => {
            const value = averages[key];
            return (
              <div key={key} className="grid grid-cols-[10rem_1fr_2.5rem] items-center gap-2">
                <span className="text-sm teacher-muted">{RUBRIC_LABELS[key]}</span>
                <div className="h-3 rounded" style={{ background: 'var(--pill-bg)' }}>
                  <div
                    className="h-3 rounded"
                    style={{ background: CHART_COLOR_VAR[bandForScore(value)], width: `${value ?? 0}%` }}
                  />
                </div>
                <span className="text-xs text-right teacher-value tabular-nums">
                  {value !== null ? Math.round(value) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
