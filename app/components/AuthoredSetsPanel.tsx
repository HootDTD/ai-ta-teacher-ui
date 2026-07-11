"use client";

import { useCallback, useEffect, useState } from 'react';
import { UploadCloud, RefreshCcw, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, Trash2, BookOpen } from 'lucide-react';

type AuthoredStatus = 'pending' | 'indexing' | 'provisioning' | 'done' | 'failed';

type AuthoredSetSummary = {
  set_id: number;
  set_index: number;
  status: AuthoredStatus;
  problem_document_id: number | null;
  solution_document_id: number | null;
};

type DraftStep = {
  step?: number;
  entry_type?: string;
  id?: string;
  content?: Record<string, unknown>;
};

type ReviewDraft = {
  solution_source?: string | null;
  reference_solution?: DraftStep[] | null;
};

// Whitelisted projection of the backend's provenance.authored_review; absent on
// responses from backends predating the review-enrichment deploy.
type ProblemReview = {
  required?: boolean;
  reason?: string | null;
  approved_reference?: string | null;
  ocr_draft?: ReviewDraft | null;
  generated_alt?: ReviewDraft | null;
};

type AuthoredProblemResult = {
  label: string | null;
  outcome: 'promoted' | 'rejected' | 'held_for_review';
  solution_source: string | null;
  match_method: string | null;
  ocr_confidence: number | null;
  failed_gate: number | null;
  diagnostic: string;
  review_required: boolean;
  reason: string | null;
  concept_problem_id: number | null;
  problem_text?: string;
  problem_text_truncated?: boolean;
  review?: ProblemReview | null;
};

type AuthoredSetDetail = AuthoredSetSummary & {
  result_summary: {
    problems?: AuthoredProblemResult[];
    counts?: Record<string, number>;
    error?: string;
  };
};

type ApproveState =
  | { status: 'pending' }
  | { status: 'approved'; reference: 'ocr' | 'generated' }
  | { status: 'error'; message: string };

const NON_TERMINAL: AuthoredStatus[] = ['pending', 'indexing', 'provisioning'];
const isNonTerminal = (s: AuthoredStatus) => NON_TERMINAL.includes(s);

const STATUS_LABEL: Record<AuthoredStatus, string> = {
  pending: 'Pending',
  indexing: 'Indexing PDFs…',
  provisioning: 'Provisioning…',
  done: 'Done',
  failed: 'Failed',
};

const HOLD_REASON_LABEL: Record<string, string> = {
  no_matching_concept: 'No matching concept in your course list',
  generated_no_match: 'AI-drafted solution needs your approval',
};

function holdReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'Needs a decision';
  return HOLD_REASON_LABEL[reason] ?? reason.replace(/_/g, ' ');
}

// FastAPI errors arrive as {"detail": "..."} — surface the detail string, not
// the raw JSON blob.
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

function effectiveOutcome(
  problem: AuthoredProblemResult,
  state: ApproveState | undefined,
): AuthoredProblemResult['outcome'] {
  if (problem.outcome !== 'held_for_review') return problem.outcome;
  if (state?.status === 'approved') return 'promoted';
  // The refetched review carries live state: required flips false on approval.
  if (problem.review && problem.review.required === false && problem.review.approved_reference) {
    return 'promoted';
  }
  return 'held_for_review';
}

function StatusBadge({ status }: { status: AuthoredStatus }) {
  if (status === 'failed') {
    return <span className="rounded-full teacher-alert teacher-alert--danger px-3 py-1 text-xs">Failed</span>;
  }
  if (status === 'done') {
    return <span className="rounded-full teacher-pill px-3 py-1 text-xs">Done</span>;
  }
  return (
    <span className="rounded-full teacher-alert teacher-alert--warning px-3 py-1 text-xs inline-flex items-center gap-1.5">
      <RefreshCcw className="h-3 w-3 animate-spin" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function AuthoredSetsPanel({
  searchSpaceId,
  accessToken,
  onGoToConcepts,
}: {
  searchSpaceId: number;
  accessToken: string;
  onGoToConcepts?: () => void;
}) {
  const [sets, setSets] = useState<AuthoredSetSummary[]>([]);
  const [details, setDetails] = useState<Record<number, AuthoredSetDetail>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [problemFile, setProblemFile] = useState<File | null>(null);
  const [solutionFile, setSolutionFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approveState, setApproveState] = useState<Record<number, ApproveState>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const authHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => ({
      Authorization: `Bearer ${accessToken}`,
      ...(extra || {}),
    }),
    [accessToken],
  );

  const fetchSets = useCallback(async () => {
    if (!accessToken || !searchSpaceId) return;
    try {
      const resp = await fetch(`/api/teacher/authored-sets?search_space_id=${searchSpaceId}`, {
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Failed to load authored sets'));
      const data = await resp.json();
      setSets(Array.isArray(data?.sets) ? data.sets : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load authored sets');
    }
  }, [accessToken, searchSpaceId, authHeaders]);

  const fetchDetail = useCallback(
    async (setId: number) => {
      try {
        const resp = await fetch(`/api/teacher/authored-sets/${setId}`, { headers: authHeaders() });
        if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Failed to load set detail'));
        const data: AuthoredSetDetail = await resp.json();
        setDetails((prev) => ({ ...prev, [setId]: data }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load set detail');
      }
    },
    [authHeaders],
  );

  // Reset and reload when the selected class changes.
  useEffect(() => {
    setSets([]);
    setDetails({});
    setExpandedId(null);
    setApproveState({});
    void fetchSets();
  }, [fetchSets]);

  // Poll while any set is still indexing/provisioning, refreshing the open detail too.
  useEffect(() => {
    const anyActive = sets.some((s) => isNonTerminal(s.status));
    const expandedActive =
      expandedId != null && (details[expandedId] ? isNonTerminal(details[expandedId].status) : true);
    if (!anyActive && !expandedActive) return;
    const timer = setInterval(() => {
      void fetchSets();
      if (expandedId != null) void fetchDetail(expandedId);
    }, 4000);
    return () => clearInterval(timer);
  }, [sets, expandedId, details, fetchSets, fetchDetail]);

  const handleUpload = async () => {
    if (!accessToken) {
      setError('Sign in is required.');
      return;
    }
    if (!problemFile) {
      setError('Select a problem PDF.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('search_space_id', String(searchSpaceId));
      fd.append('problem', problemFile);
      if (solutionFile) fd.append('solution', solutionFile);
      const resp = await fetch('/api/teacher/authored-sets', {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Upload failed'));
      setProblemFile(null);
      setSolutionFile(null);
      await fetchSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (setId: number) => {
    setDeletingId(setId);
    setError(null);
    try {
      const resp = await fetch(`/api/teacher/authored-sets/${setId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Delete failed'));
      // Drop any cached detail and collapse if this set was open.
      setDetails((prev) => {
        const next = { ...prev };
        delete next[setId];
        return next;
      });
      setExpandedId((cur) => (cur === setId ? null : cur));
      setConfirmDeleteId(null);
      await fetchSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpand = (setId: number) => {
    setExpandedId((cur) => {
      const next = cur === setId ? null : setId;
      if (next != null && !details[next]) void fetchDetail(next);
      return next;
    });
  };

  const handleApprove = async (setId: number, problemId: number, reference: 'ocr' | 'generated') => {
    setApproveState((prev) => ({ ...prev, [problemId]: { status: 'pending' } }));
    try {
      const resp = await fetch(`/api/teacher/authored-sets/${setId}/problems/${problemId}/approve`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reference }),
      });
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Approve failed'));
      // A 200 does NOT mean promoted: approve-time gates can still reject
      // ({promoted: false, diagnostic}) — surface that instead of silently
      // leaving the card unchanged.
      const data = await resp.json().catch(() => null);
      if (!data?.promoted) {
        throw new Error(
          typeof data?.diagnostic === 'string' && data.diagnostic
            ? `Could not promote: ${data.diagnostic}`
            : 'Could not promote this problem.',
        );
      }
      setApproveState((prev) => ({ ...prev, [problemId]: { status: 'approved', reference } }));
      // Authoritative refresh: live review state + counts recompute from it.
      await fetchDetail(setId);
    } catch (err) {
      setApproveState((prev) => ({
        ...prev,
        [problemId]: { status: 'error', message: err instanceof Error ? err.message : 'Approve failed' },
      }));
    }
  };

  return (
    <div className="rounded-3xl teacher-panel-soft p-5">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold teacher-section-title">Authored problem sets</div>
        <span className="rounded-full teacher-pill px-3 py-1 text-xs">Paired PDFs</span>
      </div>
      <p className="mt-1 text-sm teacher-muted">
        Upload a problem PDF and, optionally, its matching solution PDF. Each problem is grounded
        against only its paired solution; low-confidence (e.g. handwritten) extractions are held
        for your review. Without a solution PDF, Hoot drafts reference solutions that are held for
        your review before students see them.
      </p>

      {error && (
        <div className="mt-4 rounded-2xl teacher-alert teacher-alert--danger px-3 py-2 text-sm">{error}</div>
      )}

      {/* Upload form */}
      <div className="mt-4 rounded-2xl teacher-panel-subtle p-4 flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <FilePicker
            label="Problem PDF"
            file={problemFile}
            disabled={uploading}
            onPick={setProblemFile}
          />
          <FilePicker
            label="Solution PDF (optional)"
            file={solutionFile}
            disabled={uploading}
            onPick={setSolutionFile}
          />
        </div>
        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={uploading || !problemFile}
          className="teacher-button-primary h-10 rounded-2xl px-4 text-sm font-semibold self-start inline-flex items-center gap-2 disabled:opacity-50"
        >
          {uploading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Create set'}
        </button>
      </div>

      {/* Set list */}
      <div className="mt-4 flex flex-col gap-3">
        {sets.length === 0 && (
          <div className="text-sm teacher-muted">No authored sets yet.</div>
        )}
        {sets.map((set) => {
          const detail = details[set.set_id];
          const expanded = expandedId === set.set_id;
          const problems = detail?.result_summary?.problems;
          // Header counts recompute from CURRENT problem states (approvals flip
          // holds to promoted); the stored counts freeze at provisioning time.
          const counts = (() => {
            if (!problems || problems.length === 0) return detail?.result_summary?.counts;
            const live: Record<string, number> = {};
            for (const p of problems) {
              const state = p.concept_problem_id != null ? approveState[p.concept_problem_id] : undefined;
              const outcome = effectiveOutcome(p, state);
              live[outcome] = (live[outcome] ?? 0) + 1;
            }
            return live;
          })();
          const heldCount = counts?.held_for_review ?? 0;
          return (
            <div key={set.set_id} className="rounded-2xl teacher-panel-subtle p-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(set.set_id)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Set {set.set_index}
                  </span>
                  <span className="flex items-center gap-3">
                    {counts && (
                      <span className="text-xs teacher-muted">
                        {counts.promoted ?? 0} promoted · {counts.held_for_review ?? 0} held · {counts.rejected ?? 0} rejected
                      </span>
                    )}
                    <StatusBadge status={set.status} />
                  </span>
                </button>

                {confirmDeleteId === set.set_id ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={deletingId === set.set_id}
                      onClick={() => void handleDelete(set.set_id)}
                      className="teacher-alert teacher-alert--danger rounded-xl px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {deletingId === set.set_id ? 'Deleting…' : 'Confirm delete'}
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === set.set_id}
                      onClick={() => setConfirmDeleteId(null)}
                      className="teacher-button-secondary rounded-xl px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Delete set ${set.set_index}`}
                    title="Delete set"
                    onClick={() => setConfirmDeleteId(set.set_id)}
                    className="teacher-button-secondary shrink-0 rounded-xl p-2 text-rose-500 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {confirmDeleteId === set.set_id && (
                <p className="mt-2 text-xs teacher-muted">
                  This permanently removes the set, its reference PDFs, and any problems it produced.
                </p>
              )}

              {expanded && (
                <div className="mt-3 border-t pt-3">
                  {set.status === 'failed' && (
                    <div className="rounded-2xl teacher-alert teacher-alert--danger px-3 py-2 text-sm">
                      {detail?.result_summary?.error || 'Provisioning failed.'}
                    </div>
                  )}
                  {set.status !== 'failed' && !detail && (
                    <div className="flex items-center gap-2 text-sm teacher-muted">
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  )}
                  {problems?.length === 0 && set.status === 'done' && (
                    <div className="text-sm teacher-muted">No problems were scraped from this set.</div>
                  )}
                  {set.status === 'done' && (problems?.length ?? 0) > 0 && heldCount === 0 && (
                    <div className="mb-2 flex items-center gap-2 rounded-xl teacher-panel-soft px-3 py-2 text-sm teacher-muted">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      Nothing left to review — every problem in this set is resolved.
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {(problems ?? []).map((problem, idx) => {
                      const state =
                        problem.concept_problem_id != null
                          ? approveState[problem.concept_problem_id]
                          : undefined;
                      return (
                        <ProblemRow
                          key={problem.concept_problem_id ?? idx}
                          problem={problem}
                          approveState={state}
                          onGoToConcepts={onGoToConcepts}
                          onApprove={(reference) => {
                            if (problem.concept_problem_id != null) {
                              void handleApprove(set.set_id, problem.concept_problem_id, reference);
                            }
                          }}
                        />
                      );
                    })}
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

function FilePicker({
  label,
  file,
  disabled,
  onPick,
}: {
  label: string;
  file: File | null;
  disabled: boolean;
  onPick: (file: File | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wide teacher-muted">{label}</span>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl teacher-button-secondary px-3 py-2 text-sm font-semibold">
        <UploadCloud className="h-4 w-4" />
        <span className="truncate">{file ? file.name : 'Choose PDF'}</span>
        <input
          type="file"
          accept="application/pdf"
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            onPick(event.target.files?.[0] || null);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

function stepContentText(content?: Record<string, unknown>): string {
  if (!content || typeof content !== 'object') return '';
  return Object.entries(content)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' · ');
}

function DraftPreview({ heading, draft }: { heading: string; draft: ReviewDraft }) {
  const steps = Array.isArray(draft.reference_solution) ? draft.reference_solution : [];
  return (
    <div className="rounded-xl teacher-panel-soft px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">{heading}</div>
      {steps.length === 0 ? (
        <p className="mt-1 text-xs teacher-muted">No steps recorded in this draft.</p>
      ) : (
        <ol className="mt-1 flex flex-col gap-1">
          {steps.map((step, idx) => (
            <li key={step.id ?? idx} className="text-xs leading-relaxed">
              <span className="font-semibold">{step.step ?? idx + 1}.</span>{' '}
              {step.entry_type && <span className="teacher-muted">[{step.entry_type}]</span>}{' '}
              {stepContentText(step.content)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function QuestionText({ problem }: { problem: AuthoredProblemResult }) {
  if (!problem.problem_text) {
    return (
      <p className="text-xs teacher-muted italic">
        Question text unavailable for this problem.
      </p>
    );
  }
  return (
    <div className="rounded-xl teacher-panel-soft px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">Question</div>
      <p className="mt-1 whitespace-pre-wrap text-sm">
        {problem.problem_text}
        {problem.problem_text_truncated ? '…' : ''}
      </p>
    </div>
  );
}

function ProblemRow({
  problem,
  approveState,
  onApprove,
  onGoToConcepts,
}: {
  problem: AuthoredProblemResult;
  approveState: ApproveState | undefined;
  onApprove: (reference: 'ocr' | 'generated') => void;
  onGoToConcepts?: () => void;
}) {
  const title = problem.label ? `Problem ${problem.label}` : 'Problem';
  const conf =
    problem.ocr_confidence != null ? ` · OCR ${(problem.ocr_confidence * 100).toFixed(0)}%` : '';
  const outcome = effectiveOutcome(problem, approveState);

  if (outcome === 'promoted') {
    const approvedByTeacher =
      approveState?.status === 'approved' || Boolean(problem.review?.approved_reference);
    return (
      <div className="flex items-center gap-2 rounded-xl teacher-panel-soft px-3 py-2 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <span className="font-medium">{title}</span>
        <span className="teacher-muted">
          {approvedByTeacher
            ? 'approved — now teachable'
            : `promoted (${problem.solution_source}${conf})`}
        </span>
      </div>
    );
  }

  if (outcome === 'rejected') {
    return (
      <div className="flex items-center gap-2 rounded-xl teacher-panel-soft px-3 py-2 text-sm">
        <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
        <span className="font-medium">{title}</span>
        <span className="teacher-muted truncate">
          rejected{problem.failed_gate != null ? ` (gate ${problem.failed_gate})` : ''}
          {problem.diagnostic ? ` — ${problem.diagnostic}` : ''}
        </span>
      </div>
    );
  }

  // held_for_review
  const reason = problem.review?.reason ?? problem.reason;
  const pending = approveState?.status === 'pending';

  // A no_matching_concept hold stores NO draft — the backend 409s any approve.
  // Render guidance instead of buttons that can only fail.
  if (reason === 'no_matching_concept') {
    return (
      <div className="rounded-xl teacher-alert teacher-alert--warning px-3 py-2.5 text-sm flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-medium">{title}</span>
          <span className="teacher-muted">held · {holdReasonLabel(reason)}</span>
        </div>
        <QuestionText problem={problem} />
        <p className="text-xs teacher-muted">
          This question didn&apos;t match any concept in your course list, so no solution was
          drafted. Add the missing concept in the Concepts section, then re-upload this set.
        </p>
        {onGoToConcepts && (
          <button
            type="button"
            onClick={onGoToConcepts}
            className="teacher-button-secondary self-start rounded-xl px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Go to Concepts
          </button>
        )}
      </div>
    );
  }

  // Slot-driven approve buttons: one button per draft actually stored, labeled
  // by the draft's real nature. ocr_draft is "the draft that came through the
  // pipeline" — on problem-only uploads that is the AI-GENERATED draft
  // (solution_source: "generated"); generated_alt exists only on the extracted
  // path. Never render a button for an absent slot (it can only 422).
  const review = problem.review;
  const buttons: { reference: 'ocr' | 'generated'; label: string; draft: ReviewDraft | null }[] = [];
  if (review) {
    if (review.ocr_draft) {
      buttons.push({
        reference: 'ocr',
        label:
          review.ocr_draft.solution_source === 'generated'
            ? 'Approve generated solution'
            : 'Approve extracted solution (OCR)',
        draft: review.ocr_draft,
      });
    }
    if (review.generated_alt) {
      buttons.push({
        reference: 'generated',
        label: 'Approve AI-generated alternative',
        draft: review.generated_alt,
      });
    }
  } else {
    // Old response shape (backend not yet deployed): no slot info. reason is
    // still present, so a generated-draft hold gets its one valid button; only
    // genuine extracted-path holds keep both legacy choices.
    buttons.push({ reference: 'ocr', label: 'Approve pipeline draft', draft: null });
    if (reason !== 'generated_no_match') {
      buttons.push({ reference: 'generated', label: 'Use AI-generated', draft: null });
    }
  }

  return (
    <div className="rounded-xl teacher-alert teacher-alert--warning px-3 py-2.5 text-sm flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="font-medium">{title}</span>
        <span className="teacher-muted">held · {holdReasonLabel(reason)}{conf}</span>
      </div>
      <QuestionText problem={problem} />
      {buttons.map(
        (button) =>
          button.draft && (
            <DraftPreview
              key={`draft-${button.reference}`}
              heading={
                button.reference === 'generated'
                  ? 'AI-generated alternative'
                  : button.draft.solution_source === 'generated'
                    ? 'AI-drafted solution'
                    : 'Extracted (OCR) solution'
              }
              draft={button.draft}
            />
          ),
      )}
      {buttons.length === 0 && (
        <p className="text-xs teacher-muted">
          No stored draft to approve — delete this set and re-upload it.
        </p>
      )}
      {approveState?.status === 'error' && (
        <div className="rounded-xl teacher-alert teacher-alert--danger px-3 py-1.5 text-xs">
          {approveState.message}
        </div>
      )}
      {buttons.length > 0 && (
        <>
          <p className="text-xs teacher-muted">
            Approving promotes the solution so students can teach this problem back.
          </p>
          <div className="flex flex-wrap gap-2">
            {buttons.map((button) => (
              <button
                key={button.reference}
                type="button"
                disabled={pending}
                onClick={() => onApprove(button.reference)}
                className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {pending && <RefreshCcw className="h-3 w-3 animate-spin" />}
                {pending ? 'Approving…' : button.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
