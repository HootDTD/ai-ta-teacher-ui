"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';

type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed';

function droppedTotal(dropped: Record<string, number> | null | undefined): number {
  return Object.values(dropped ?? {}).reduce((sum, count) => sum + count, 0);
}

type GenerationRun = {
  run_id: number;
  concept_id: number;
  status: RunStatus;
  created_at: string;
  requested: number;
  written_count: number;
  // Per-drop-reason counts, e.g. {leaked: 1, duplicate: 2}; may be absent
  // while the run is still pending.
  dropped?: Record<string, number> | null;
};

type DraftStep = {
  step?: number;
  entry_type?: string;
  id?: string;
  content?: Record<string, unknown>;
};

type GeneratedProblem = {
  concept_problem_id: number;
  problem_text: string;
  difficulty: string;
  tier: number;
  review: {
    variation_operator: string;
    aig_seed_id: number;
    model: string;
    round_trip: {
      verdict: 'verified' | 'unresolved' | 'inapplicable';
      diagnostic?: string | null;
    } | null;
    qualitative_rubric?: {
      claims: { claim: string; supported: boolean; note?: string | null }[];
      unsupported_count: number;
      ceiling: number;
    } | null;
    authored_review: { required: boolean };
    ocr_draft: {
      solution_source?: string | null;
      reference_solution?: DraftStep[] | null;
    } | null;
  };
};

type RunDetail = GenerationRun & {
  ingest_run: {
    llm_calls: number;
    llm_tokens_in: number;
    llm_tokens_out: number;
    llm_cost_usd: number;
  } | null;
  result_summary: {
    dropped?: Record<string, number>;
    error?: string | null;
  };
  problems: GeneratedProblem[];
};

type ApproveState =
  | { status: 'pending' }
  | { status: 'approved' }
  | { status: 'error'; message: string };

const NON_TERMINAL: RunStatus[] = ['pending', 'running'];
const isNonTerminal = (status: RunStatus) => NON_TERMINAL.includes(status);

async function readErrorDetail(resp: Response, fallback: string): Promise<string> {
  const text = await resp.text().catch(() => '');
  try {
    const data = JSON.parse(text);
    if (typeof data?.detail === 'string') return data.detail;
  } catch {
    /* not JSON — fall through to raw text */
  }
  return text || `${fallback} (HTTP ${resp.status})`;
}

function RunStatusBadge({ status }: { status: RunStatus }) {
  if (status === 'failed') {
    return <span className="rounded-full teacher-alert teacher-alert--danger px-3 py-1 text-xs">Failed</span>;
  }
  if (status === 'succeeded') {
    return <span className="rounded-full teacher-pill teacher-pill--success px-3 py-1 text-xs">Succeeded</span>;
  }
  return (
    <span className="rounded-full teacher-alert teacher-alert--warning px-3 py-1 text-xs inline-flex items-center gap-1.5">
      <RefreshCcw className="h-3 w-3 animate-spin" />
      {status === 'pending' ? 'Pending' : 'Running…'}
    </span>
  );
}

function createdAtLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function GeneratedProblemsPanel({
  searchSpaceId,
  accessToken,
  onGoToConcepts,
}: {
  searchSpaceId: number;
  accessToken: string;
  onGoToConcepts?: () => void;
}) {
  const [runs, setRuns] = useState<GenerationRun[]>([]);
  const [details, setDetails] = useState<Record<number, RunDetail>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [approveState, setApproveState] = useState<Record<number, ApproveState>>({});
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => ({
      Authorization: `Bearer ${accessToken}`,
      ...(extra || {}),
    }),
    [accessToken],
  );

  const fetchRuns = useCallback(async () => {
    if (!accessToken || !searchSpaceId) return;
    try {
      const resp = await fetch(
        `/api/teacher/problem-generation/runs?search_space_id=${searchSpaceId}`,
        { headers: authHeaders() },
      );
      if (resp.status === 404) {
        setAvailable(false);
        setRuns([]);
        setError(null);
        return;
      }
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Failed to load generation runs'));
      const data = await resp.json();
      const nextRuns: GenerationRun[] = Array.isArray(data?.runs) ? data.runs : [];
      nextRuns.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setRuns(nextRuns);
      setAvailable(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load generation runs');
    } finally {
      setLoading(false);
    }
  }, [accessToken, searchSpaceId, authHeaders]);

  const fetchDetail = useCallback(
    async (runId: number) => {
      try {
        const resp = await fetch(`/api/teacher/problem-generation/runs/${runId}`, {
          headers: authHeaders(),
        });
        if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Failed to load run detail'));
        const data: RunDetail = await resp.json();
        setDetails((prev) => ({ ...prev, [runId]: data }));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load run detail');
      }
    },
    [authHeaders],
  );

  useEffect(() => {
    setRuns([]);
    setDetails({});
    setExpandedId(null);
    setApproveState({});
    setAvailable(true);
    setError(null);
    setLoading(true);
    void fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    const anyActive = runs.some((run) => isNonTerminal(run.status));
    const expandedActive =
      expandedId != null &&
      (details[expandedId] ? isNonTerminal(details[expandedId].status) : true);
    if (!available || (!anyActive && !expandedActive)) return;
    const timer = setInterval(() => {
      void fetchRuns();
      if (expandedId != null) void fetchDetail(expandedId);
    }, 4000);
    return () => clearInterval(timer);
  }, [runs, expandedId, details, available, fetchRuns, fetchDetail]);

  const toggleExpand = (runId: number) => {
    setExpandedId((current) => {
      const next = current === runId ? null : runId;
      if (next != null && !details[next]) void fetchDetail(next);
      return next;
    });
  };

  const handleApprove = async (runId: number, problemId: number) => {
    setApproveState((prev) => ({ ...prev, [problemId]: { status: 'pending' } }));
    try {
      const resp = await fetch(
        `/api/teacher/problem-generation/problems/${problemId}/approve`,
        {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ reference: 'ocr' }),
        },
      );
      if (resp.status === 409) {
        setApproveState((prev) => ({ ...prev, [problemId]: { status: 'approved' } }));
        await fetchDetail(runId);
        return;
      }
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Approve failed'));
      const data = await resp.json().catch(() => null);
      if (!data?.promoted) {
        throw new Error(
          typeof data?.diagnostic === 'string' && data.diagnostic
            ? `Could not promote: ${data.diagnostic}`
            : 'Could not promote this problem.',
        );
      }
      setApproveState((prev) => ({ ...prev, [problemId]: { status: 'approved' } }));
      await fetchDetail(runId);
    } catch (err) {
      setApproveState((prev) => ({
        ...prev,
        [problemId]: {
          status: 'error',
          message: err instanceof Error ? err.message : 'Approve failed',
        },
      }));
    }
  };

  if (!available) {
    return (
      <div className="rounded-3xl teacher-panel-soft p-5">
        <div className="flex items-center gap-2 text-sm teacher-muted">
          <Sparkles className="h-4 w-4" />
          Problem generation isn&apos;t available on this deployment yet.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl teacher-panel-soft p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold teacher-section-title">Generated problems</div>
        <span className="rounded-full teacher-pill px-3 py-1 text-xs">AI variants</span>
      </div>
      <p className="mt-1 text-sm teacher-muted">
        Review generated variants and their validation evidence before making them teachable.
      </p>

      {error && (
        <div className="mt-4 rounded-2xl teacher-alert teacher-alert--danger px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {loading && runs.length === 0 && (
          <div className="flex items-center gap-2 text-sm teacher-muted">
            <RefreshCcw className="h-4 w-4 animate-spin" />
            Loading generation runs…
          </div>
        )}
        {!loading && runs.length === 0 && (
          <div className="rounded-2xl teacher-panel-subtle p-4 text-sm teacher-muted">
            <p>No generation runs yet.</p>
            {onGoToConcepts && (
              <button
                type="button"
                onClick={onGoToConcepts}
                className="mt-3 teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Go to Concepts
              </button>
            )}
          </div>
        )}
        {runs.map((run) => {
          const expanded = expandedId === run.run_id;
          const detail = details[run.run_id];
          const droppedBreakdown = Object.entries(detail?.result_summary?.dropped ?? {}).filter(
            ([, count]) => count > 0,
          );
          return (
            <div key={run.run_id} className="rounded-2xl teacher-panel-subtle p-4">
              <button
                type="button"
                onClick={() => toggleExpand(run.run_id)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <span className="flex min-w-0 items-start gap-2">
                  {expanded ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Run {run.run_id}</span>
                    <span className="mt-0.5 block text-xs teacher-muted">
                      {createdAtLabel(run.created_at)} · {run.requested} requested ·{' '}
                      {run.written_count} written · {droppedTotal(run.dropped)} dropped
                    </span>
                  </span>
                </span>
                <RunStatusBadge status={run.status} />
              </button>

              {expanded && (
                <div className="mt-3 border-t pt-3 flex flex-col gap-3">
                  {!detail && (
                    <div className="flex items-center gap-2 text-sm teacher-muted">
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                      Loading run details…
                    </div>
                  )}
                  {detail?.status === 'failed' && (
                    <div className="rounded-2xl teacher-alert teacher-alert--danger px-3 py-2 text-sm">
                      {detail.result_summary?.error || 'Problem generation failed.'}
                    </div>
                  )}
                  {detail?.ingest_run && (
                    <p className="text-xs teacher-muted">
                      LLM cost ${detail.ingest_run.llm_cost_usd.toFixed(4)} ·{' '}
                      {detail.ingest_run.llm_calls.toLocaleString()} calls ·{' '}
                      {detail.ingest_run.llm_tokens_in.toLocaleString()} input tokens ·{' '}
                      {detail.ingest_run.llm_tokens_out.toLocaleString()} output tokens
                    </p>
                  )}
                  {droppedBreakdown.length > 0 && (
                    <div className="rounded-xl teacher-panel-soft px-3 py-2 text-xs teacher-muted">
                      <span className="font-semibold">Dropped:</span>{' '}
                      {droppedBreakdown
                        .map(([reason, count]) => `${reason.replace(/_/g, ' ')} (${count})`)
                        .join(' · ')}
                    </div>
                  )}
                  {detail?.status === 'succeeded' && detail.problems.length === 0 && (
                    <p className="text-sm teacher-muted">This run did not write any problems.</p>
                  )}
                  <div className="flex flex-col gap-3">
                    {(detail?.problems ?? []).map((problem) => (
                      <GeneratedProblemCard
                        key={problem.concept_problem_id}
                        problem={problem}
                        approveState={approveState[problem.concept_problem_id]}
                        onApprove={() =>
                          void handleApprove(run.run_id, problem.concept_problem_id)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GeneratedProblemCard({
  problem,
  approveState,
  onApprove,
}: {
  problem: GeneratedProblem;
  approveState: ApproveState | undefined;
  onApprove: () => void;
}) {
  const review = problem.review;
  const approved = approveState?.status === 'approved' || review.authored_review.required === false;
  const pending = approveState?.status === 'pending';

  return (
    <div
      className={`rounded-xl px-3 py-3 text-sm flex flex-col gap-2 ${
        approved
          ? 'teacher-alert teacher-alert--success'
          : 'teacher-alert teacher-alert--warning'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {approved ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        )}
        <span className="font-semibold">Problem {problem.concept_problem_id}</span>
        <span className="teacher-pill teacher-pill--neutral rounded-full px-2 py-0.5 text-xs">
          {problem.difficulty}
        </span>
        <RoundTripBadge roundTrip={review.round_trip} />
        {approved && <span className="text-xs teacher-muted">Approved · now teachable</span>}
      </div>

      <div className="rounded-xl teacher-panel-soft px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">Question</div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{problem.problem_text}</p>
      </div>

      <p className="text-xs teacher-muted">
        {review.variation_operator.replace(/_/g, ' ')} · seed {review.aig_seed_id} · {review.model}
      </p>

      {review.qualitative_rubric && (
        <QualitativeRubric rubric={review.qualitative_rubric} />
      )}

      {review.ocr_draft && (
        <DraftPreview draft={review.ocr_draft} />
      )}

      {approveState?.status === 'error' && (
        <div className="rounded-xl teacher-alert teacher-alert--danger px-3 py-1.5 text-xs">
          {approveState.message}
        </div>
      )}

      {!approved && (
        <div>
          <button
            type="button"
            disabled={pending}
            onClick={onApprove}
            className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {pending && <RefreshCcw className="h-3 w-3 animate-spin" />}
            {pending ? 'Approving…' : 'Approve extracted solution'}
          </button>
        </div>
      )}
    </div>
  );
}

function RoundTripBadge({
  roundTrip,
}: {
  roundTrip: GeneratedProblem['review']['round_trip'];
}) {
  if (!roundTrip) return null;
  const label = roundTrip.verdict.replace(/_/g, ' ');
  if (roundTrip.verdict === 'verified') {
    return (
      <span
        title={roundTrip.diagnostic || undefined}
        className="rounded-full teacher-pill teacher-pill--success px-2 py-0.5 text-xs"
      >
        {label}
      </span>
    );
  }
  if (roundTrip.verdict === 'unresolved') {
    return (
      <span
        title={roundTrip.diagnostic || undefined}
        className="rounded-full teacher-alert teacher-alert--warning px-2 py-0.5 text-xs"
      >
        {label}
      </span>
    );
  }
  return (
    <span
      title={roundTrip.diagnostic || undefined}
      className="rounded-full teacher-pill teacher-pill--neutral px-2 py-0.5 text-xs"
    >
      {label}
    </span>
  );
}

function QualitativeRubric({
  rubric,
}: {
  rubric: NonNullable<GeneratedProblem['review']['qualitative_rubric']>;
}) {
  return (
    <div className="rounded-xl teacher-panel-soft px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide teacher-muted">
          Qualitative rubric
        </span>
        <span className="text-xs teacher-muted">Faithfulness only · ceiling {rubric.ceiling}</span>
      </div>
      <ul className="mt-1 flex flex-col gap-1">
        {rubric.claims.map((claim, index) => (
          <li
            key={index}
            className={`text-xs ${claim.supported ? 'teacher-muted' : 'text-amber-700 dark:text-amber-300'}`}
          >
            {claim.supported ? '✓' : '⚠'} {claim.claim}
            {claim.note ? ` — ${claim.note}` : ''}
          </li>
        ))}
      </ul>
      {rubric.unsupported_count > 0 && (
        <p className="mt-1 text-xs font-semibold">
          {rubric.unsupported_count} unsupported claim{rubric.unsupported_count === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}

function stepContentText(content?: Record<string, unknown>): string {
  if (!content || typeof content !== 'object') return '';
  return Object.entries(content)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' · ');
}

function DraftPreview({
  draft,
}: {
  draft: NonNullable<GeneratedProblem['review']['ocr_draft']>;
}) {
  const steps = Array.isArray(draft.reference_solution) ? draft.reference_solution : [];
  return (
    <div className="rounded-xl teacher-panel-soft px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">
        Reference solution {draft.solution_source ? `· ${draft.solution_source}` : ''}
      </div>
      {steps.length === 0 ? (
        <p className="mt-1 text-xs teacher-muted">No reference-solution steps recorded.</p>
      ) : (
        <ol className="mt-1 flex flex-col gap-1">
          {steps.map((step, index) => (
            <li key={step.id ?? index} className="text-xs leading-relaxed">
              <span className="font-semibold">{step.step ?? index + 1}.</span>{' '}
              {step.entry_type && <span className="teacher-muted">[{step.entry_type}]</span>}{' '}
              {stepContentText(step.content)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
