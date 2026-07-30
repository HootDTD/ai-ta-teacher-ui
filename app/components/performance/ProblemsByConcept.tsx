import { bandForLetter, CHART_COLOR_VAR, formatScore } from './utils';
import type { ProblemRow } from './types';

// Stacked letter-distribution mini-bar for one problem. Segment widths are
// flex-grow proportions of the graded count per letter (flex-basis 0 + a
// container gap keeps the 2px surface separator between segments — see the
// dataviz skill's mark spec for stacked fills).
function DistributionBar({ distribution }: { distribution: ProblemRow['distribution'] }) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) {
    return <div className="h-3 rounded" style={{ background: 'var(--pill-bg)' }} />;
  }
  return (
    <div
      className="flex h-3 rounded overflow-hidden"
      style={{ background: 'var(--pill-bg)', gap: '2px' }}
      title={distribution.map((d) => `${d.letter}: ${d.count}`).join(', ')}
    >
      {distribution
        .filter((d) => d.count > 0)
        .map((d) => (
          <div
            key={d.letter}
            style={{ flex: `${d.count} 0 0px`, background: CHART_COLOR_VAR[bandForLetter(d.letter)] }}
          />
        ))}
    </div>
  );
}

export default function ProblemsByConcept({ problems }: { problems: ProblemRow[] }) {
  const byConcept = new Map<number, { name: string; rows: ProblemRow[] }>();
  for (const p of problems) {
    const group = byConcept.get(p.concept_id) ?? { name: p.concept_name, rows: [] };
    group.rows.push(p);
    byConcept.set(p.concept_id, group);
  }

  return (
    <div className="rounded-3xl teacher-panel-soft p-5 space-y-3">
      <div>
        <h2 className="text-lg font-semibold teacher-section-title">Problems by concept</h2>
        <p className="text-xs teacher-muted">Best-attempt grade distribution per problem</p>
      </div>
      {problems.length === 0 ? (
        <p className="text-sm teacher-muted">No graded problems yet.</p>
      ) : (
        <div className="space-y-4">
          {[...byConcept.entries()].map(([conceptId, group]) => (
            <div key={conceptId} className="space-y-2">
              <h3 className="text-sm font-semibold teacher-value">{group.name}</h3>
              <div className="space-y-2">
                {group.rows.map((p) => (
                  <div key={p.problem_id} className="grid grid-cols-[6rem_1fr_3rem_4.5rem] items-center gap-3">
                    <span className="text-sm teacher-muted truncate" title={p.problem_code}>
                      {p.problem_code}
                    </span>
                    <DistributionBar distribution={p.distribution} />
                    <span className="text-xs text-right teacher-value tabular-nums">{formatScore(p.avg_best)}</span>
                    <span className="text-xs text-right teacher-muted tabular-nums">
                      {p.students_graded} student{p.students_graded === 1 ? '' : 's'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
