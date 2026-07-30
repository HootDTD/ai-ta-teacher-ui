import { bandForLetter, CHART_COLOR_VAR } from './utils';
import type { DistributionBucket } from './types';

export default function GradeDistribution({ buckets }: { buckets: DistributionBucket[] }) {
  const max = Math.max(1, ...buckets.map((d) => d.count));
  const total = buckets.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-3xl teacher-panel-soft p-5 space-y-3">
      <div>
        <h2 className="text-lg font-semibold teacher-section-title">Grade distribution</h2>
        <p className="text-xs teacher-muted">Best grade per student × problem</p>
      </div>
      {total === 0 && <p className="text-sm teacher-muted">No graded attempts yet.</p>}
      <div className="flex items-end gap-2 h-36 border-b" style={{ borderColor: 'var(--border)' }}>
        {buckets.map((bucket) => (
          <div
            key={bucket.letter}
            className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
            title={`${bucket.letter}: ${bucket.count}`}
          >
            {bucket.count > 0 && <span className="text-[11px] teacher-muted">{bucket.count}</span>}
            <div
              className="w-3/4 max-w-8 rounded-t"
              style={{
                background: CHART_COLOR_VAR[bandForLetter(bucket.letter)],
                height: `${(bucket.count / max) * 112}px`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {buckets.map((bucket) => (
          <span key={bucket.letter} className="flex-1 text-center text-[11px] teacher-muted">
            {bucket.letter}
          </span>
        ))}
      </div>
      <div className="flex gap-4 text-xs teacher-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ background: CHART_COLOR_VAR.green }} />
          A band
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ background: CHART_COLOR_VAR.blue }} />
          B / C
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ background: CHART_COLOR_VAR.red }} />
          D / F
        </span>
      </div>
    </div>
  );
}
