import { CHART_COLOR_VAR } from './utils';
import type { PerformancePayload } from './types';

export default function ActivityByDay({ days }: { days: PerformancePayload['activity_by_day'] }) {
  const max = Math.max(1, ...days.map((d) => d.graded + d.in_progress));

  return (
    <div className="rounded-3xl teacher-panel-soft p-5 space-y-3">
      <div>
        <h2 className="text-lg font-semibold teacher-section-title">Activity by day</h2>
        <p className="text-xs teacher-muted">Teaching attempts per day (UTC)</p>
      </div>
      {days.length === 0 ? (
        <p className="text-sm teacher-muted">No attempts yet.</p>
      ) : (
        <>
          <div className="flex items-end gap-2 h-36 border-b" style={{ borderColor: 'var(--border)' }}>
            {days.map((day) => {
              const total = day.graded + day.in_progress;
              return (
                <div
                  key={day.day}
                  className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
                  title={`${day.day} — graded ${day.graded}, in progress ${day.in_progress}`}
                >
                  {total > 0 && <span className="text-[11px] teacher-muted">{total}</span>}
                  <div className="w-3/4 max-w-8 flex flex-col justify-end gap-[2px]">
                    {day.in_progress > 0 && (
                      <div
                        className="w-full rounded-t"
                        style={{ background: 'var(--muted)', height: `${(day.in_progress / max) * 104}px` }}
                      />
                    )}
                    {day.graded > 0 && (
                      <div
                        className={`w-full ${day.in_progress === 0 ? 'rounded-t' : ''}`}
                        style={{ background: CHART_COLOR_VAR.blue, height: `${(day.graded / max) * 104}px` }}
                      />
                    )}
                  </div>
                  <span className="text-[11px] teacher-muted mt-1 truncate max-w-full">{day.day.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 text-xs teacher-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded" style={{ background: CHART_COLOR_VAR.blue }} />
              Graded
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded" style={{ background: 'var(--muted)' }} />
              In progress
            </span>
          </div>
        </>
      )}
    </div>
  );
}
