import { notStartedCount } from './utils';
import type { PerformancePayload } from './types';

export default function StatTiles({
  roster,
  totals,
  classAverage,
}: {
  roster: PerformancePayload['roster'];
  totals: PerformancePayload['totals'];
  classAverage: PerformancePayload['class_average'];
}) {
  const notStarted = notStartedCount(roster, totals);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-3xl teacher-panel-soft p-4">
        <p className="text-xs teacher-muted">Students enrolled</p>
        <p className="text-2xl font-semibold teacher-value">{roster.students}</p>
        <p className="text-xs teacher-muted">
          {totals.active_students} active · {totals.signed_in_only} signed in only
        </p>
      </div>
      <div className="rounded-3xl teacher-panel-soft p-4">
        <p className="text-xs teacher-muted">Teaching attempts</p>
        <p className="text-2xl font-semibold teacher-value">{totals.attempts}</p>
        <p className="text-xs teacher-muted">{totals.graded} graded</p>
      </div>
      <div className="rounded-3xl teacher-panel-soft p-4">
        <p className="text-xs teacher-muted">Class average</p>
        <p className="text-2xl font-semibold teacher-value">
          {classAverage.score !== null ? `${Math.round(classAverage.score)} · ${classAverage.letter}` : '—'}
        </p>
        <p className="text-xs teacher-muted">
          {classAverage.students_graded} student{classAverage.students_graded === 1 ? '' : 's'} graded
        </p>
      </div>
      <div className="rounded-3xl teacher-panel-soft p-4">
        <p className="text-xs teacher-muted">Not started</p>
        <p className="text-2xl font-semibold teacher-value">{notStarted}</p>
        <p className="text-xs teacher-muted">enrolled, no Apollo activity</p>
      </div>
    </div>
  );
}
