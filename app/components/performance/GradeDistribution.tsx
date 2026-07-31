'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { CHART_COLOR_VAR, bandForLetter, studentLabel } from './utils';
import type { DistributionBucket, ProblemRow, ProblemStudentGrade, StudentRow } from './types';

const PANEL_ID = 'grade-distribution-drilldown';

type ProblemMatches = { problem: ProblemRow; matches: ProblemStudentGrade[] };

// Client-side join for the letter drill-down (design spec v2.1: "no new
// backend block — the UI joins problems[].students by letter"). Primary path
// reads the per-problem students[] the v2.1 backend adds; when every problem
// row still has an empty students[] (v2-only backend, not yet redeployed),
// falls back to joining the top-level students[].best_grades against
// problems by problem_id — same backend data, just not pre-grouped per
// problem yet, so the drill-down keeps working through the deploy skew.
function drilldownForLetter(letter: string, problems: ProblemRow[], students: StudentRow[]): ProblemMatches[] {
  const anyPerProblemStudents = problems.some((p) => p.students.length > 0);

  if (anyPerProblemStudents) {
    return problems
      .map((problem) => ({
        problem,
        matches: problem.students
          .filter((s) => s.letter === letter)
          .sort((a, b) => b.score - a.score),
      }))
      .filter((entry) => entry.matches.length > 0);
  }

  const problemById = new Map(problems.map((p) => [p.problem_id, p]));
  const byProblem = new Map<number, ProblemStudentGrade[]>();
  for (const s of students) {
    for (const bg of s.best_grades) {
      if (bg.letter !== letter) continue;
      const list = byProblem.get(bg.problem_id) ?? [];
      list.push({ user_id: s.user_id, email: s.email, score: bg.score, letter: bg.letter });
      byProblem.set(bg.problem_id, list);
    }
  }
  return [...byProblem.entries()]
    .map(([problemId, matches]) => {
      const problem = problemById.get(problemId);
      return problem ? { problem, matches: matches.sort((a, b) => b.score - a.score) } : null;
    })
    .filter((entry): entry is ProblemMatches => entry !== null);
}

function DrilldownPanel({
  letter,
  problems,
  students,
  onClose,
}: {
  letter: string;
  problems: ProblemRow[];
  students: StudentRow[];
  onClose: () => void;
}) {
  const entries = useMemo(() => drilldownForLetter(letter, problems, students), [letter, problems, students]);

  return (
    <div id={PANEL_ID} className="rounded-2xl teacher-panel-subtle p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold teacher-value">Problems graded {letter}</h3>
        <button
          type="button"
          onClick={onClose}
          className="teacher-button-secondary h-7 rounded-full px-2.5 text-xs inline-flex items-center gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs teacher-muted">No problems recorded a {letter} grade.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(({ problem, matches }) => (
            <div key={problem.problem_id} className="space-y-1.5">
              <p
                className="text-sm teacher-value line-clamp-2"
                title={problem.problem_text || problem.problem_code}
              >
                {problem.problem_text || problem.problem_code}
              </p>
              <ul className="space-y-1">
                {matches.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="teacher-muted truncate">{studentLabel(m)}</span>
                    <span className="teacher-value tabular-nums">{Math.round(m.score)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GradeDistribution({
  buckets,
  problems,
  students,
}: {
  buckets: DistributionBucket[];
  problems: ProblemRow[];
  students: StudentRow[];
}) {
  const [openLetter, setOpenLetter] = useState<string | null>(null);
  const max = Math.max(1, ...buckets.map((d) => d.count));
  const total = buckets.reduce((sum, d) => sum + d.count, 0);

  const toggleLetter = (letter: string) => setOpenLetter((current) => (current === letter ? null : letter));

  return (
    <div className="rounded-3xl teacher-panel-soft p-5 space-y-3">
      <div>
        <h2 className="text-lg font-semibold teacher-section-title">Grade distribution</h2>
        <p className="text-xs teacher-muted">Best grade per student × problem — click a bar to see which problems</p>
      </div>
      {total === 0 && <p className="text-sm teacher-muted">No graded attempts yet.</p>}
      <div className="flex items-end gap-2 h-36 border-b" style={{ borderColor: 'var(--border)' }}>
        {buckets.map((bucket) => {
          const interactive = bucket.count > 0;
          const isOpen = openLetter === bucket.letter;
          return (
            <button
              key={bucket.letter}
              type="button"
              onClick={() => interactive && toggleLetter(bucket.letter)}
              disabled={!interactive}
              aria-expanded={isOpen}
              aria-controls={PANEL_ID}
              aria-label={
                interactive
                  ? `Grade ${bucket.letter}: ${bucket.count} students — show problems`
                  : `Grade ${bucket.letter}: 0 students`
              }
              title={`${bucket.letter}: ${bucket.count}`}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0 rounded-t border-0 bg-transparent p-0 disabled:cursor-default enabled:cursor-pointer"
            >
              {bucket.count > 0 && (
                <span className={`text-[11px] ${isOpen ? 'font-semibold teacher-value' : 'teacher-muted'}`}>
                  {bucket.count}
                </span>
              )}
              <div
                className="w-3/4 max-w-8 rounded-t"
                style={{
                  background: CHART_COLOR_VAR[bandForLetter(bucket.letter)],
                  height: `${(bucket.count / max) * 112}px`,
                }}
              />
            </button>
          );
        })}
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
      {openLetter && (
        <DrilldownPanel letter={openLetter} problems={problems} students={students} onClose={() => setOpenLetter(null)} />
      )}
    </div>
  );
}
