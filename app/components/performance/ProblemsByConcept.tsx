'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CHART_COLOR_VAR, bandForLetter, formatScore, letterPillClass, studentLabel } from './utils';
import type { ProblemNode, ProblemRow } from './types';

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

// Per-node right/wrong stacked bar for the expanded "what students get right /
// wrong" table — same understood(green)/partial(blue)/missed(red) semantics
// as the rest of the section, reusing CHART_COLOR_VAR (dataviz skill: never
// hardcode hex).
function NodeStackedBar({ node }: { node: ProblemNode }) {
  const total = node.understood + node.partial + node.missed;
  if (total === 0) {
    return <div className="h-2.5 rounded" style={{ background: 'var(--pill-bg)' }} />;
  }
  return (
    <div
      className="flex h-2.5 rounded overflow-hidden"
      style={{ background: 'var(--pill-bg)', gap: '2px' }}
      title={`Understood: ${node.understood}, Partial: ${node.partial}, Missed: ${node.missed}`}
    >
      {node.understood > 0 && <div style={{ flex: `${node.understood} 0 0px`, background: CHART_COLOR_VAR.green }} />}
      {node.partial > 0 && <div style={{ flex: `${node.partial} 0 0px`, background: CHART_COLOR_VAR.blue }} />}
      {node.missed > 0 && <div style={{ flex: `${node.missed} 0 0px`, background: CHART_COLOR_VAR.red }} />}
    </div>
  );
}

function NodeTable({ nodes }: { nodes: ProblemNode[] }) {
  if (nodes.length === 0) {
    return <p className="text-xs teacher-muted">Node-level detail not available yet.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-[11px] teacher-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ background: CHART_COLOR_VAR.green }} />
          Understood
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ background: CHART_COLOR_VAR.blue }} />
          Partial
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ background: CHART_COLOR_VAR.red }} />
          Missed
        </span>
      </div>
      <div className="space-y-1.5">
        {nodes.map((node) => (
          <div key={node.node_id} className="grid grid-cols-[1fr_9rem_5rem] items-center gap-2.5">
            <span className="text-xs teacher-value truncate" title={node.display_name}>
              {node.display_name}
            </span>
            <NodeStackedBar node={node} />
            <span className="text-[11px] text-right teacher-muted tabular-nums">
              {node.understood}/{node.partial}/{node.missed}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentGradeList({ students }: { students: ProblemRow['students'] }) {
  if (students.length === 0) {
    return <p className="text-xs teacher-muted">No per-student detail yet.</p>;
  }
  return (
    <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {students.map((s) => (
        <li key={s.user_id} className="flex items-center justify-between gap-2 py-1 text-xs">
          <span className="teacher-value truncate">{studentLabel(s)}</span>
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <span className={`${letterPillClass(s.letter)} text-[11px]`}>{s.letter}</span>
            <span className="teacher-value tabular-nums">{Math.round(s.score)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProblemDetail({ problem }: { problem: ProblemRow }) {
  const panelId = `problem-detail-${problem.problem_id}`;
  return (
    <div id={panelId} className="rounded-2xl teacher-panel-subtle p-4 ml-6 mt-1 space-y-4">
      <div>
        <h4 className="text-xs font-semibold teacher-muted uppercase tracking-wide mb-1">Problem</h4>
        <p className="text-sm teacher-value whitespace-pre-wrap">
          {problem.problem_text || 'Full problem text not available yet.'}
        </p>
      </div>
      <div>
        <h4 className="text-xs font-semibold teacher-muted uppercase tracking-wide mb-2">
          What students get right / wrong
        </h4>
        <NodeTable nodes={problem.nodes} />
      </div>
      <div>
        <h4 className="text-xs font-semibold teacher-muted uppercase tracking-wide mb-2">Students</h4>
        <StudentGradeList students={problem.students} />
      </div>
    </div>
  );
}

function ProblemRowItem({ problem }: { problem: ProblemRow }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `problem-detail-${problem.problem_id}`;
  const snippet = problem.problem_text || problem.problem_code;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full text-left grid grid-cols-[1.25rem_1fr_9rem_3rem_4.5rem] items-center gap-3 rounded-lg px-1 py-1.5 transition-colors hover:bg-[var(--btn-secondary-bg)]"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 teacher-muted shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 teacher-muted shrink-0" />
        )}
        <span className="text-sm teacher-value line-clamp-2" title={snippet}>
          {snippet}
        </span>
        <DistributionBar distribution={problem.distribution} />
        <span className="text-xs text-right teacher-value tabular-nums">{formatScore(problem.avg_best)}</span>
        <span className="text-xs text-right teacher-muted tabular-nums">
          {problem.students_graded} student{problem.students_graded === 1 ? '' : 's'}
        </span>
      </button>
      {expanded && <ProblemDetail problem={problem} />}
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
        <p className="text-xs teacher-muted">
          Best-attempt grade distribution per problem — click a problem to see the full text and
          per-node breakdown.
        </p>
      </div>
      {problems.length === 0 ? (
        <p className="text-sm teacher-muted">No graded problems yet.</p>
      ) : (
        <div className="space-y-4">
          {[...byConcept.entries()].map(([conceptId, group]) => (
            <div key={conceptId} className="space-y-2">
              <h3 className="text-sm font-semibold teacher-value">{group.name}</h3>
              <div className="space-y-1">
                {group.rows.map((p) => (
                  <ProblemRowItem key={p.problem_id} problem={p} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
