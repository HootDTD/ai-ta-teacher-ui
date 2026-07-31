'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { FLAG_META, formatWhen, letterPillClass, studentLabel } from './utils';
import type { StudentRow } from './types';

type SortDir = 'asc' | 'desc';

// Null avg_best always sorts last, regardless of direction (design spec §3
// StudentTable.tsx).
function compareByAvgBest(a: StudentRow, b: StudentRow, dir: SortDir): number {
  if (a.avg_best === null && b.avg_best === null) return 0;
  if (a.avg_best === null) return 1;
  if (b.avg_best === null) return -1;
  return dir === 'desc' ? b.avg_best - a.avg_best : a.avg_best - b.avg_best;
}

export default function StudentTable({ students, notStarted }: { students: StudentRow[]; notStarted: number }) {
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(
    () => [...students].sort((a, b) => compareByAvgBest(a, b, sortDir)),
    [students, sortDir],
  );

  return (
    <div className="rounded-3xl teacher-panel-soft p-5 space-y-3">
      <div>
        <h2 className="text-lg font-semibold teacher-section-title">Students</h2>
        <p className="text-xs teacher-muted">
          Every account with Apollo activity. {notStarted > 0 && `${notStarted} enrolled students have not started yet.`}
        </p>
      </div>
      {students.length === 0 ? (
        <p className="text-sm teacher-muted">No student activity yet — check back after the first session.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs teacher-muted">
                <th className="py-1.5 pr-2 font-medium">Student</th>
                <th className="py-1.5 px-2 font-medium text-right">
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                    className="inline-flex items-center gap-1 font-medium teacher-muted hover:text-inherit"
                    title="Sort by average grade"
                  >
                    Avg grade
                    {sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                  </button>
                </th>
                <th className="py-1.5 px-2 font-medium text-right">Problems graded</th>
                <th className="py-1.5 px-2 font-medium text-right">Attempts</th>
                <th className="py-1.5 px-2 font-medium text-right">Teaching turns</th>
                <th className="py-1.5 px-2 font-medium text-right">Words/msg</th>
                <th className="py-1.5 px-2 font-medium">Flags</th>
                <th className="py-1.5 pl-2 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((student) => (
                <tr key={student.user_id} className="border-t align-top" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2 pr-2 teacher-value">{studentLabel(student)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {student.avg_best !== null && student.letter ? (
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <span className={`${letterPillClass(student.letter)} text-xs`}>{student.letter}</span>
                        <span className="teacher-value">{Math.round(student.avg_best)}</span>
                      </span>
                    ) : (
                      <span className="teacher-muted">—</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{student.best_grades.length}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{student.attempts}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{student.engagement.teaching_turns}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {student.engagement.median_words !== null ? student.engagement.median_words.toFixed(1) : '—'}
                  </td>
                  <td className="py-2 px-2">
                    {student.flags.length === 0 ? (
                      <span className="text-xs teacher-muted">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {student.flags.map((flag) => (
                          <span
                            key={flag}
                            className="teacher-pill teacher-pill--danger text-xs whitespace-nowrap"
                            title={FLAG_META[flag].title}
                          >
                            {FLAG_META[flag].label}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pl-2 whitespace-nowrap text-xs teacher-muted">
                    {formatWhen(student.last_active)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
