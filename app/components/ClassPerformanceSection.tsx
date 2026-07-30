"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Payload contract: GET /apollo/teacher/classroom/{search_space_id}/performance
// (apollo/projections/performance.py). Grades are best-attempt-wins per
// (student, problem) and carry the SERVED letter — teacher and student always
// see the same grade.
type BestGrade = { problem_id: number; score: number; letter: string };
type StudentRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  attempts: number;
  graded: number;
  problems_tried: number;
  best_grades: BestGrade[];
  avg_best: number | null;
  letter: string | null;
  xp: number;
  level: number;
  last_active: string | null;
};
type PerformancePayload = {
  roster: { students: number; teachers: number };
  totals: { attempts: number; graded: number; active_students: number; signed_in_only: number };
  class_average: { score: number | null; letter: string | null; students_graded: number };
  grade_distribution: { letter: string; count: number }[];
  activity_by_day: { day: string; graded: number; in_progress: number }[];
  rubric_averages: Record<string, number | null>;
  concepts: {
    concept_id: number;
    display_name: string;
    attempts: number;
    graded: number;
    problems_graded: number;
    avg_best: number | null;
  }[];
  students: StudentRow[];
};

const POLL_INTERVAL_MS = 60_000;

const RUBRIC_LABELS: Record<string, string> = {
  procedure: 'Procedure',
  justification: 'Justification',
  simplification: 'Simplification',
  misconception_corrected: 'Misconceptions corrected',
};

function letterPillClass(letter: string): string {
  if (letter.startsWith('A')) return 'teacher-pill teacher-pill--success';
  if (letter === 'F' || letter === 'D') return 'teacher-pill teacher-pill--danger';
  return 'teacher-pill teacher-pill--neutral';
}

function studentLabel(s: StudentRow): string {
  return s.full_name || s.email || `Student ${s.user_id.slice(0, 8)}`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ClassPerformanceSection({
  searchSpaceId,
  accessToken,
}: {
  searchSpaceId: number | null;
  accessToken: string | null;
}) {
  const [data, setData] = useState<PerformancePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetchPerformance = useCallback(
    async (background = false) => {
      if (!accessToken || !searchSpaceId) return;
      if (!background) setLoading(true);
      try {
        const resp = await fetch(`/api/teacher/classroom/${searchSpaceId}/performance`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (!resp.ok) {
          let detail = `Request failed (${resp.status})`;
          try {
            const body = await resp.json();
            if (body?.detail) detail = String(body.detail);
          } catch {
            /* non-JSON error body — keep the status message */
          }
          throw new Error(detail);
        }
        setData((await resp.json()) as PerformancePayload);
        setUpdatedAt(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load class performance');
      } finally {
        if (!background) setLoading(false);
      }
    },
    [accessToken, searchSpaceId],
  );

  useEffect(() => {
    setData(null);
    setError(null);
    void fetchPerformance();
    const timer = setInterval(() => void fetchPerformance(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchPerformance]);

  const distributionMax = useMemo(
    () => Math.max(1, ...(data?.grade_distribution.map((d) => d.count) ?? [])),
    [data],
  );
  const dayMax = useMemo(
    () => Math.max(1, ...(data?.activity_by_day.map((d) => d.graded + d.in_progress) ?? [])),
    [data],
  );
  const notStarted = data
    ? Math.max(0, data.roster.students - data.totals.active_students - data.totals.signed_in_only)
    : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold teacher-section-title">Class performance</h1>
          <p className="text-sm teacher-muted">
            Apollo teaching grades, best attempt per student per problem — the same grade students
            see. Refreshes automatically every minute.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-xs teacher-muted">
              Updated {updatedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void fetchPerformance()}
            disabled={loading}
            className="teacher-button-secondary h-9 rounded-2xl px-3 text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {error && <div className="teacher-alert teacher-alert--danger rounded-2xl p-3 text-sm">{error}</div>}

      {!data && loading && <p className="text-sm teacher-muted">Loading class performance…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-3xl teacher-panel-soft p-4">
              <p className="text-xs teacher-muted">Students enrolled</p>
              <p className="text-2xl font-semibold teacher-value">{data.roster.students}</p>
              <p className="text-xs teacher-muted">
                {data.totals.active_students} active · {data.totals.signed_in_only} signed in only
              </p>
            </div>
            <div className="rounded-3xl teacher-panel-soft p-4">
              <p className="text-xs teacher-muted">Teaching attempts</p>
              <p className="text-2xl font-semibold teacher-value">{data.totals.attempts}</p>
              <p className="text-xs teacher-muted">{data.totals.graded} graded</p>
            </div>
            <div className="rounded-3xl teacher-panel-soft p-4">
              <p className="text-xs teacher-muted">Class average</p>
              <p className="text-2xl font-semibold teacher-value">
                {data.class_average.score !== null
                  ? `${Math.round(data.class_average.score)} · ${data.class_average.letter}`
                  : '—'}
              </p>
              <p className="text-xs teacher-muted">
                {data.class_average.students_graded} student{data.class_average.students_graded === 1 ? '' : 's'} graded
              </p>
            </div>
            <div className="rounded-3xl teacher-panel-soft p-4">
              <p className="text-xs teacher-muted">Not started</p>
              <p className="text-2xl font-semibold teacher-value">{notStarted}</p>
              <p className="text-xs teacher-muted">enrolled, no Apollo activity</p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-3xl teacher-panel-soft p-5 space-y-3">
              <div>
                <h2 className="text-lg font-semibold teacher-section-title">Grade distribution</h2>
                <p className="text-xs teacher-muted">Best grade per student × problem</p>
              </div>
              <div
                className="flex items-end gap-2 h-36 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                {data.grade_distribution.map((bucket) => (
                  <div
                    key={bucket.letter}
                    className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
                    title={`${bucket.letter}: ${bucket.count}`}
                  >
                    {bucket.count > 0 && <span className="text-[11px] teacher-muted">{bucket.count}</span>}
                    <div
                      className="w-3/4 max-w-8 rounded-t"
                      style={{
                        background: 'var(--accent)',
                        height: `${(bucket.count / distributionMax) * 112}px`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {data.grade_distribution.map((bucket) => (
                  <span key={bucket.letter} className="flex-1 text-center text-[11px] teacher-muted">
                    {bucket.letter}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl teacher-panel-soft p-5 space-y-3">
              <div>
                <h2 className="text-lg font-semibold teacher-section-title">Activity by day</h2>
                <p className="text-xs teacher-muted">Teaching attempts per day (UTC)</p>
              </div>
              {data.activity_by_day.length === 0 ? (
                <p className="text-sm teacher-muted">No attempts yet.</p>
              ) : (
                <>
                  <div
                    className="flex items-end gap-2 h-36 border-b"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {data.activity_by_day.map((day) => {
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
                                style={{
                                  background: 'var(--muted)',
                                  height: `${(day.in_progress / dayMax) * 104}px`,
                                }}
                              />
                            )}
                            {day.graded > 0 && (
                              <div
                                className={`w-full ${day.in_progress === 0 ? 'rounded-t' : ''}`}
                                style={{
                                  background: 'var(--accent)',
                                  height: `${(day.graded / dayMax) * 104}px`,
                                }}
                              />
                            )}
                          </div>
                          <span className="text-[11px] teacher-muted mt-1 truncate max-w-full">
                            {day.day.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 text-xs teacher-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded" style={{ background: 'var(--accent)' }} />
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
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-3xl teacher-panel-soft p-5 space-y-3">
              <div>
                <h2 className="text-lg font-semibold teacher-section-title">Where the class loses points</h2>
                <p className="text-xs teacher-muted">Average rubric score across all graded attempts</p>
              </div>
              {Object.values(data.rubric_averages).every((v) => v === null) ? (
                <p className="text-sm teacher-muted">No graded attempts yet.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(RUBRIC_LABELS).map(([key, label]) => {
                    const value = data.rubric_averages[key];
                    return (
                      <div key={key} className="grid grid-cols-[10rem_1fr_2.5rem] items-center gap-2">
                        <span className="text-sm teacher-muted">{label}</span>
                        <div className="h-3 rounded" style={{ background: 'var(--pill-bg)' }}>
                          <div
                            className="h-3 rounded"
                            style={{ background: 'var(--accent)', width: `${value ?? 0}%` }}
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

            <div className="rounded-3xl teacher-panel-soft p-5 space-y-3">
              <div>
                <h2 className="text-lg font-semibold teacher-section-title">By concept</h2>
                <p className="text-xs teacher-muted">Best-attempt averages of graded problems</p>
              </div>
              {data.concepts.length === 0 ? (
                <p className="text-sm teacher-muted">No attempts yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs teacher-muted">
                        <th className="py-1.5 pr-2 font-medium">Concept</th>
                        <th className="py-1.5 px-2 font-medium text-right">Attempts</th>
                        <th className="py-1.5 px-2 font-medium text-right">Graded</th>
                        <th className="py-1.5 pl-2 font-medium text-right">Avg (best)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.concepts.map((concept) => (
                        <tr key={concept.concept_id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                          <td className="py-2 pr-2">{concept.display_name}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{concept.attempts}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{concept.graded}</td>
                          <td className="py-2 pl-2 text-right tabular-nums">
                            {concept.avg_best !== null ? Math.round(concept.avg_best) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl teacher-panel-soft p-5 space-y-3">
            <div>
              <h2 className="text-lg font-semibold teacher-section-title">Students</h2>
              <p className="text-xs teacher-muted">
                Every account with Apollo activity. {notStarted > 0 && `${notStarted} enrolled students have not started yet.`}
              </p>
            </div>
            {data.students.length === 0 ? (
              <p className="text-sm teacher-muted">No student activity yet — check back after the first session.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs teacher-muted">
                      <th className="py-1.5 pr-2 font-medium">Student</th>
                      <th className="py-1.5 px-2 font-medium text-right">Problems</th>
                      <th className="py-1.5 px-2 font-medium text-right">Attempts</th>
                      <th className="py-1.5 px-2 font-medium">Best grades</th>
                      <th className="py-1.5 px-2 font-medium text-right">Avg</th>
                      <th className="py-1.5 px-2 font-medium text-right">XP</th>
                      <th className="py-1.5 pl-2 font-medium">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((student) => (
                      <tr key={student.user_id} className="border-t align-top" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-2 pr-2">
                          <span className="teacher-value">{studentLabel(student)}</span>
                          {student.full_name && student.email && (
                            <span className="block text-xs teacher-muted">{student.email}</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{student.problems_tried}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{student.attempts}</td>
                        <td className="py-2 px-2">
                          {student.best_grades.length === 0 ? (
                            <span className="text-xs teacher-muted">
                              {student.attempts > 0 ? 'in progress' : 'signed in, no attempts'}
                            </span>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {student.best_grades.map((grade) => (
                                <span
                                  key={grade.problem_id}
                                  className={`${letterPillClass(grade.letter)} text-xs`}
                                  title={`Problem ${grade.problem_id}: ${grade.score}`}
                                >
                                  {grade.letter}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {student.avg_best !== null ? `${Math.round(student.avg_best)} · ${student.letter}` : '—'}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {student.xp} · L{student.level}
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
        </>
      )}
    </div>
  );
}
