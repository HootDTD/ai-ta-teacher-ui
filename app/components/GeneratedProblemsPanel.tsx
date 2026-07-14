"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Pencil,
  RefreshCcw,
  Save,
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

type ReferenceStep = {
  step: number;
  entry_type: 'equation' | 'definition' | 'condition' | 'simplification' | 'variable_mapping' | 'procedure_step';
  id: string;
  content: Record<string, unknown>;
  depends_on: string[];
  entity_key?: string | null;
};

type GeneratedProblem = {
  concept_problem_id: number;
  problem_text: string;
  problem_text_truncated: boolean;
  difficulty: string;
  tier: number;
  review: {
    variation_operator: string | null;
    aig_seed_id: number | null;
    model: string | null;
    round_trip: {
      verdict: 'verified' | 'unresolved' | 'inapplicable';
      diagnostic?: string | null;
    } | null;
    qualitative_rubric?: {
      claims: { claim: string; supported: boolean; note?: string | null }[];
      unsupported_count: number;
      ceiling: string;
    } | null;
    authored_review: { required: boolean };
    ocr_draft: {
      solution_source: string | null;
      reference_solution: ReferenceStep[] | null;
    } | null;
  };
};

type ProblemEditRequest = {
  problem_text?: string;
  reference_solution?: { id: string; content: Record<string, unknown> }[];
};

type EditedProblemResponse = {
  concept_problem_id: number;
  problem_text: string;
  problem_text_truncated: boolean;
  reference_solution?: ReferenceStep[] | null;
  solution_text?: string;
  review: {
    required: boolean;
    reason: string | null;
    approved_reference: string | null;
    augmented: string | null;
    ocr_draft?: {
      solution_source: string | null;
      reference_solution: ReferenceStep[] | null;
    } | null;
    generated_alt?: {
      solution_source: string | null;
      reference_solution: ReferenceStep[] | null;
    } | null;
  } | null;
};

type ProblemEditOverlay = {
  problem_text: string;
  reference_solution?: ReferenceStep[];
};

type RunDetail = GenerationRun & {
  ingest_run: {
    llm_calls: number;
    llm_tokens_in: number;
    llm_tokens_out: number;
    // Serialized Decimal — the backend sends this as a string.
    llm_cost_usd: string;
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
  const [editOverlays, setEditOverlays] = useState<Record<number, ProblemEditOverlay>>({});
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
        const resp = await fetch(`/api/teacher/problem-generation/runs/${runId}?full_text=1`, {
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
    setEditOverlays({});
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

  const handleEdit = async (
    runId: number,
    problemId: number,
    request: ProblemEditRequest,
  ): Promise<EditedProblemResponse> => {
    const resp = await fetch(`/api/teacher/problems/${problemId}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(request),
    });
    if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Save failed'));
    const updated: EditedProblemResponse = await resp.json();
    await fetchDetail(runId);
    setEditOverlays((current) => ({
      ...current,
      [problemId]: {
        problem_text: updated.problem_text,
        ...(Array.isArray(updated.reference_solution)
          ? { reference_solution: updated.reference_solution }
          : {}),
      },
    }));
    return updated;
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
                      LLM cost ${Number(detail.ingest_run.llm_cost_usd).toFixed(4)} ·{' '}
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
                        editOverlay={editOverlays[problem.concept_problem_id]}
                        approveState={approveState[problem.concept_problem_id]}
                        onSave={(request) =>
                          handleEdit(run.run_id, problem.concept_problem_id, request)
                        }
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
  editOverlay,
  approveState,
  onApprove,
  onSave,
}: {
  problem: GeneratedProblem;
  editOverlay: ProblemEditOverlay | undefined;
  approveState: ApproveState | undefined;
  onApprove: () => void;
  onSave: (request: ProblemEditRequest) => Promise<EditedProblemResponse>;
}) {
  const [editing, setEditing] = useState(false);
  const [editProblemText, setEditProblemText] = useState('');
  const [editSteps, setEditSteps] = useState<ReferenceStep[]>([]);
  const [editPending, setEditPending] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const review = problem.review;
  const approved = approveState?.status === 'approved' || review.authored_review.required === false;
  const pending = approveState?.status === 'pending';
  const displayedProblemText = editOverlay?.problem_text ?? problem.problem_text;
  const displayedSteps =
    editOverlay?.reference_solution ?? review.ocr_draft?.reference_solution ?? [];
  const editableSteps = approved ? displayedSteps : [];

  const beginEdit = () => {
    setEditProblemText(displayedProblemText);
    setEditSteps(cloneReferenceSteps(editableSteps));
    setEditError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditProblemText(displayedProblemText);
    setEditSteps(cloneReferenceSteps(editableSteps));
    setEditError(null);
  };

  const updateStepString = (stepIndex: number, key: string, value: string) => {
    setEditSteps((current) =>
      current.map((step, index) =>
        index === stepIndex
          ? { ...step, content: { ...step.content, [key]: value } }
          : step,
      ),
    );
  };

  const saveEdit = async () => {
    setEditPending(true);
    setEditError(null);
    try {
      const request: ProblemEditRequest = {};
      if (editProblemText !== displayedProblemText) {
        request.problem_text = editProblemText;
      }
      if (approved) {
        const originalStepEdits = displayedSteps.map((step) => ({
          id: step.id,
          content: step.content,
        }));
        const nextStepEdits = editSteps.map((step) => ({ id: step.id, content: step.content }));
        if (JSON.stringify(nextStepEdits) !== JSON.stringify(originalStepEdits)) {
          request.reference_solution = nextStepEdits;
        }
      }
      if (request.problem_text == null && request.reference_solution == null) {
        setEditing(false);
        return;
      }
      await onSave(request);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setEditPending(false);
    }
  };

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
        <button
          type="button"
          aria-expanded={editing}
          aria-label={
            editing
              ? `Cancel editing problem ${problem.concept_problem_id}`
              : `Edit problem ${problem.concept_problem_id}`
          }
          title={editing ? 'Cancel editing' : 'Edit problem'}
          disabled={editPending}
          onClick={editing ? cancelEdit : beginEdit}
          className="teacher-button-secondary ml-auto shrink-0 rounded-lg p-1.5 disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {editing ? (
        <GeneratedProblemEditFields
          problemId={problem.concept_problem_id}
          problemText={editProblemText}
          steps={editSteps}
          canEditSteps={approved}
          pending={editPending}
          error={editError}
          questionMayBeTruncated={!editOverlay && problem.problem_text_truncated}
          onProblemTextChange={setEditProblemText}
          onStepStringChange={updateStepString}
          onSave={() => void saveEdit()}
          onCancel={cancelEdit}
        />
      ) : (
        <>
          <div className="rounded-xl teacher-panel-soft px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">Question</div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{displayedProblemText}</p>
          </div>
          {displayedSteps.length > 0 && (
            <ReferenceSolutionPreview steps={displayedSteps} />
          )}
        </>
      )}

      <p className="text-xs teacher-muted">
        {(review.variation_operator ?? 'unknown operator').replace(/_/g, ' ')} · seed{' '}
        {review.aig_seed_id ?? 'unknown'} · {review.model ?? 'unknown model'}
      </p>

      {review.qualitative_rubric && (
        <QualitativeRubric rubric={review.qualitative_rubric} />
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

function stepContentText(content: Record<string, unknown>): string {
  return Object.entries(content)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' · ');
}

function cloneReferenceSteps(steps: ReferenceStep[]): ReferenceStep[] {
  return steps.map((step) => ({
    ...step,
    content: { ...step.content },
    depends_on: [...step.depends_on],
  }));
}

function ReferenceSolutionPreview({ steps }: { steps: ReferenceStep[] }) {
  return (
    <div className="rounded-xl teacher-panel-soft px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">
        Reference solution
      </div>
      {steps.length === 0 ? (
        <p className="mt-1 text-xs teacher-muted">No reference-solution steps recorded.</p>
      ) : (
        <ol className="mt-1 flex flex-col gap-1">
          {steps.map((step, index) => (
            <li key={step.id || index} className="text-xs leading-relaxed">
              <span className="font-semibold">{step.step || index + 1}.</span>{' '}
              <span className="teacher-muted">[{step.entry_type}]</span>{' '}
              {stepContentText(step.content)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function GeneratedProblemEditFields({
  problemId,
  problemText,
  steps,
  canEditSteps,
  pending,
  error,
  questionMayBeTruncated,
  onProblemTextChange,
  onStepStringChange,
  onSave,
  onCancel,
}: {
  problemId: number;
  problemText: string;
  steps: ReferenceStep[];
  canEditSteps: boolean;
  pending: boolean;
  error: string | null;
  questionMayBeTruncated: boolean;
  onProblemTextChange: (value: string) => void;
  onStepStringChange: (stepIndex: number, key: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`generated-problem-${problemId}-question-edit`} className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide teacher-muted">Question</span>
        <textarea
          id={`generated-problem-${problemId}-question-edit`}
          required
          rows={5}
          value={problemText}
          disabled={pending}
          onChange={(event) => onProblemTextChange(event.target.value)}
          className="teacher-input rounded-xl px-3 py-2 text-sm disabled:opacity-50"
        />
      </label>
      {questionMayBeTruncated && (
        <div className="rounded-xl teacher-alert teacher-alert--warning px-3 py-2 text-xs">
          This generation run returned only the first 2,000 question characters. Editing the
          question may replace text that is not shown; solution-step-only edits leave it unchanged.
        </div>
      )}

      {!canEditSteps && (
        <p className="text-xs teacher-muted">
          Solution steps become editable after approval.
        </p>
      )}

      {canEditSteps && steps.length > 0 && (
        <div className="rounded-xl teacher-panel-soft px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">
            Reference solution
          </div>
          <div className="mt-2 flex flex-col gap-3">
            {steps.map((step, stepIndex) => (
              <div key={step.id} className="rounded-xl teacher-panel-subtle p-3">
                <p className="text-xs font-semibold">
                  Step {step.step} <span className="teacher-muted">[{step.entry_type}] · {step.id}</span>
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {Object.entries(step.content).map(([key, value], contentIndex) => {
                    const fieldId = `generated-problem-${problemId}-step-${stepIndex}-content-${contentIndex}`;
                    if (typeof value === 'string') {
                      return (
                        <label key={key} htmlFor={fieldId} className="flex flex-col gap-1">
                          <span className="text-xs teacher-muted">{key.replace(/_/g, ' ')}</span>
                          <textarea
                            id={fieldId}
                            rows={2}
                            value={value}
                            disabled={pending}
                            onChange={(event) =>
                              onStepStringChange(stepIndex, key, event.target.value)
                            }
                            className="teacher-input rounded-xl px-3 py-2 text-sm disabled:opacity-50"
                          />
                        </label>
                      );
                    }
                    return (
                      <div key={key} className="text-xs teacher-muted">
                        <span className="font-semibold">{key.replace(/_/g, ' ')}:</span>{' '}
                        {JSON.stringify(value)} <span className="italic">(read-only)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl teacher-alert teacher-alert--danger px-3 py-2 text-xs">
          {error}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !problemText.trim()}
          onClick={onSave}
          className="teacher-button-primary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {pending ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
