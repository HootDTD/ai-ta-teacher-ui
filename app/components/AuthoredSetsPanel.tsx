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
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react';

type AuthoredStatus = 'pending' | 'indexing' | 'provisioning' | 'done' | 'failed';

type AuthoredSetSummary = {
  set_id: number;
  set_index: number;
  status: AuthoredStatus;
  problem_document_id: number | null;
  solution_document_id: number | null;
};

type ReferenceStep = {
  step: number;
  entry_type: 'equation' | 'definition' | 'condition' | 'simplification' | 'variable_mapping' | 'procedure_step';
  id: string;
  content: Record<string, unknown>;
  depends_on: string[];
  entity_key?: string | null;
};

type ReviewDraft = {
  solution_source: string | null;
  reference_solution: ReferenceStep[] | null;
};

// Mirrors apollo/ontology/edges.py Edge.model_dump() as emitted by
// Problem.to_kg_graph() into typed_confirmation.draft.edges.
type KGEdge = {
  edge_type: 'PRECEDES' | 'USES' | 'DEPENDS_ON' | 'SCOPES';
  from_node_id: string;
  to_node_id: string;
  from_node_type?: string | null;
  to_node_type?: string | null;
  provenance?: 'explicit' | 'inferred';
};

type TypedConfirmationDraft = {
  steps: ReferenceStep[];
  edges: KGEdge[];
  solution: string;
};

// Mirrors provenance.typed_confirmation written by
// apollo/provisioning/orchestrator.py + confirm_typed_problem in
// apollo/provisioning/authored_sets/api.py.
type TypedConfirmation = {
  status: 'awaiting_teacher_confirmation' | 'teacher_confirmed' | 'teacher_confirmed_not_promoted';
  constructed_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  diagnostics: string[];
  draft: TypedConfirmationDraft;
  diagnostic?: string;
};

// Mirrors provenance.typed_rehoming written by
// apollo/provisioning/authored_sets/rehoming.py.
type TypedRehoming = {
  status: 'rehoming_pending' | 'rehoming_running' | 'rehoming_complete' | 'rehoming_failed';
  diagnostic: string;
  job_id: number | null;
  requested_concept_id?: number | null;
  review_required?: boolean;
  retryable?: boolean;
};

// Whitelisted projection of /apollo/teacher/concepts — the same list used to
// enforce "never display the provisional category" (excluded server-side).
type ConceptOption = {
  id: number;
  display_name: string;
};

// Whitelisted projection of the backend's provenance.authored_review; absent on
// responses from backends predating the review-enrichment deploy.
type ProblemReview = {
  required?: boolean;
  reason?: string | null;
  approved_reference?: string | null;
  augmented?: string | null;
  ocr_draft?: ReviewDraft | null;
  generated_alt?: ReviewDraft | null;
};

type AuthoredProblemResult = {
  label: string | null;
  outcome: 'promoted' | 'rejected' | 'held_for_review' | 'awaiting_teacher_confirmation' | 'discarded';
  solution_source: string | null;
  match_method: string | null;
  ocr_confidence: number | null;
  failed_gate?: number | null;
  diagnostic?: string;
  review_required: boolean;
  reason: string | null;
  concept_problem_id: number | null;
  problem_text?: string;
  problem_text_truncated?: boolean;
  reference_solution?: ReferenceStep[] | null;
  solution_text?: string;
  review?: ProblemReview | null;
  rejected_problem_id?: number;
  rejected_stage?: string;
  confirmation?: TypedConfirmation | null;
  rehoming?: TypedRehoming | null;
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

type TypedActionState = { status: 'pending' } | { status: 'error'; message: string };

type ConfirmTypedResponse =
  | { promoted: true; failed_gate: number | null; diagnostic: string; rehoming: string; job_id: number }
  | { promoted: false; outcome: 'held_for_review' | 'rejected'; failed_gate: number | null; diagnostic: string };

type ManualAuthoredSetRequest = {
  search_space_id: number;
  problems: { problem_text: string; solution_text?: string }[];
  replace_problem_id?: number;
};

type ManualAuthoredSetResponse = {
  set_id: number;
  set_index: number;
  status: 'pending';
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
  review: ProblemReview | null;
};

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
  const [manualQuestion, setManualQuestion] = useState('');
  const [manualSolution, setManualSolution] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approveState, setApproveState] = useState<Record<number, ApproveState>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [concepts, setConcepts] = useState<ConceptOption[]>([]);
  const [typedActionState, setTypedActionState] = useState<Record<number, TypedActionState>>({});
  const [assignActionState, setAssignActionState] = useState<Record<number, TypedActionState>>({});

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

  // Existing-concept selector for rehoming_failed assignment. The backend list
  // already excludes the shared provisional-inventory slug — no client-side
  // filtering needed to satisfy "never display the provisional category."
  const fetchConcepts = useCallback(async () => {
    if (!accessToken || !searchSpaceId) return;
    try {
      const resp = await fetch(`/api/teacher/concepts?search_space_id=${searchSpaceId}`, {
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Failed to load concepts'));
      const data = await resp.json();
      setConcepts(Array.isArray(data?.concepts) ? data.concepts : []);
    } catch {
      // Non-fatal: the assign selector just shows empty until the next poll.
    }
  }, [accessToken, searchSpaceId, authHeaders]);

  const fetchDetail = useCallback(
    async (setId: number) => {
      try {
        const resp = await fetch(`/api/teacher/authored-sets/${setId}?full_text=1`, {
          headers: authHeaders(),
        });
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
    setConcepts([]);
    setTypedActionState({});
    setAssignActionState({});
    void fetchSets();
    void fetchConcepts();
  }, [fetchSets, fetchConcepts]);

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

  const handleManualSubmit = async () => {
    if (!accessToken) {
      setError('Sign in is required.');
      return;
    }
    const problemText = manualQuestion.trim();
    if (!problemText) {
      setError('Enter a question.');
      return;
    }
    setSubmittingManual(true);
    setError(null);
    try {
      const request: ManualAuthoredSetRequest = {
        search_space_id: searchSpaceId,
        problems: [
          {
            problem_text: problemText,
            ...(manualSolution.trim() ? { solution_text: manualSolution.trim() } : {}),
          },
        ],
      };
      const resp = await fetch('/api/teacher/authored-sets/manual', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(request),
      });
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Problem creation failed'));
      const created: ManualAuthoredSetResponse = await resp.json();
      setManualQuestion('');
      setManualSolution('');
      setExpandedId(created.set_id);
      await Promise.all([fetchDetail(created.set_id), fetchSets()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Problem creation failed');
    } finally {
      setSubmittingManual(false);
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

  const handleEdit = async (
    setId: number,
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
    await fetchDetail(setId);
    return updated;
  };

  const handleConfirmTyped = async (setId: number, problemId: number) => {
    setTypedActionState((prev) => ({ ...prev, [problemId]: { status: 'pending' } }));
    try {
      const resp = await fetch(`/api/teacher/authored-sets/${setId}/problems/${problemId}/confirm`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Approve failed'));
      const data: ConfirmTypedResponse = await resp.json();
      if (!data.promoted) {
        throw new Error(
          typeof data.diagnostic === 'string' && data.diagnostic
            ? `Could not promote: ${data.diagnostic}`
            : 'Could not promote this problem.',
        );
      }
      setTypedActionState((prev) => {
        const next = { ...prev };
        delete next[problemId];
        return next;
      });
      await Promise.all([fetchDetail(setId), fetchSets()]);
    } catch (err) {
      setTypedActionState((prev) => ({
        ...prev,
        [problemId]: { status: 'error', message: err instanceof Error ? err.message : 'Approve failed' },
      }));
    }
  };

  const handleDiscardTyped = async (setId: number, problemId: number) => {
    setTypedActionState((prev) => ({ ...prev, [problemId]: { status: 'pending' } }));
    try {
      const resp = await fetch(`/api/teacher/authored-sets/${setId}/problems/${problemId}/discard`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Discard failed'));
      setTypedActionState((prev) => {
        const next = { ...prev };
        delete next[problemId];
        return next;
      });
      await Promise.all([fetchDetail(setId), fetchSets()]);
    } catch (err) {
      setTypedActionState((prev) => ({
        ...prev,
        [problemId]: { status: 'error', message: err instanceof Error ? err.message : 'Discard failed' },
      }));
    }
  };

  // Edit & resubmit is a fresh manual submission: the backend discards the old
  // pending draft server-side (replace_problem_id) and provisions a brand new
  // authored set, so this opens/refreshes that new set the same way the "Write
  // a problem" form does.
  const handleEditResubmitTyped = async (
    setId: number,
    problemId: number,
    problemText: string,
    solutionText: string,
  ) => {
    setTypedActionState((prev) => ({ ...prev, [problemId]: { status: 'pending' } }));
    try {
      const request: ManualAuthoredSetRequest = {
        search_space_id: searchSpaceId,
        problems: [
          {
            problem_text: problemText,
            ...(solutionText.trim() ? { solution_text: solutionText.trim() } : {}),
          },
        ],
        replace_problem_id: problemId,
      };
      const resp = await fetch('/api/teacher/authored-sets/manual', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(request),
      });
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Resubmit failed'));
      const created: ManualAuthoredSetResponse = await resp.json();
      setTypedActionState((prev) => {
        const next = { ...prev };
        delete next[problemId];
        return next;
      });
      setExpandedId(created.set_id);
      await Promise.all([fetchDetail(setId), fetchDetail(created.set_id), fetchSets()]);
    } catch (err) {
      setTypedActionState((prev) => ({
        ...prev,
        [problemId]: { status: 'error', message: err instanceof Error ? err.message : 'Resubmit failed' },
      }));
    }
  };

  const handleAssignConcept = async (setId: number, problemId: number, conceptId: number) => {
    setAssignActionState((prev) => ({ ...prev, [problemId]: { status: 'pending' } }));
    try {
      const resp = await fetch(
        `/api/teacher/authored-sets/${setId}/problems/${problemId}/rehoming/assign`,
        {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ concept_id: conceptId }),
        },
      );
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Assign failed'));
      setAssignActionState((prev) => {
        const next = { ...prev };
        delete next[problemId];
        return next;
      });
      await fetchDetail(setId);
    } catch (err) {
      setAssignActionState((prev) => ({
        ...prev,
        [problemId]: { status: 'error', message: err instanceof Error ? err.message : 'Assign failed' },
      }));
    }
  };

  return (
    <div className="rounded-3xl teacher-panel-soft p-5">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold teacher-section-title">Authored problem sets</div>
        <span className="rounded-full teacher-pill px-3 py-1 text-xs">PDF or typed</span>
      </div>
      <p className="mt-1 text-sm teacher-muted">
        Upload a problem PDF or write a question directly. Optional answers ground the reference
        solution; otherwise Hoot drafts one for your review before students see it.
      </p>

      {error && (
        <div className="mt-4 rounded-2xl teacher-alert teacher-alert--danger px-3 py-2 text-sm">{error}</div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {/* Upload form */}
        <div className="rounded-2xl teacher-panel-subtle p-4 flex flex-col gap-3">
          <div className="text-sm font-semibold teacher-section-title">Upload PDFs</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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

        {/* Manual authoring form */}
        <div className="rounded-2xl teacher-panel-subtle p-4 flex flex-col gap-3">
          <div className="text-sm font-semibold teacher-section-title">Write a problem</div>
          <label htmlFor="manual-problem-question" className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide teacher-muted">Question</span>
            <textarea
              id="manual-problem-question"
              required
              rows={4}
              value={manualQuestion}
              disabled={submittingManual}
              onChange={(event) => setManualQuestion(event.target.value)}
              className="rounded-2xl teacher-input px-3 py-2 text-sm disabled:opacity-50"
              placeholder="Write the full problem statement…"
            />
          </label>
          <label htmlFor="manual-problem-answer" className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide teacher-muted">Answer (optional)</span>
            <textarea
              id="manual-problem-answer"
              rows={3}
              value={manualSolution}
              disabled={submittingManual}
              onChange={(event) => setManualSolution(event.target.value)}
              className="rounded-2xl teacher-input px-3 py-2 text-sm disabled:opacity-50"
              placeholder="Add a worked answer or leave blank for an AI draft…"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleManualSubmit()}
            disabled={submittingManual || !manualQuestion.trim()}
            className="teacher-button-primary h-10 rounded-2xl px-4 text-sm font-semibold self-start inline-flex items-center gap-2 disabled:opacity-50"
          >
            {submittingManual ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            {submittingManual ? 'Creating…' : 'Create problem'}
          </button>
        </div>
      </div>

      {/* Set list */}
      <div className="mt-4 flex flex-col gap-3">
        {sets.length === 0 && (
          <div className="text-sm teacher-muted">No authored sets yet.</div>
        )}
        {sets.map((set) => {
          const detail = details[set.set_id];
          const expanded = expandedId === set.set_id;
          const detailId = `authored-set-${set.set_id}-detail`;
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
          const rehomingFailedCount = (problems ?? []).filter(
            (p) => p.rehoming?.status === 'rehoming_failed',
          ).length;
          const heldCount =
            (counts?.held_for_review ?? 0) +
            (counts?.awaiting_teacher_confirmation ?? 0) +
            rehomingFailedCount;
          return (
            <div key={set.set_id} className="rounded-2xl teacher-panel-subtle p-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={detailId}
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
                <div id={detailId} className="mt-3 border-t pt-3">
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
                          bodyId={`authored-set-${set.set_id}-problem-${idx}`}
                          problem={problem}
                          approveState={state}
                          onGoToConcepts={onGoToConcepts}
                          onSave={(request) =>
                            handleEdit(set.set_id, problem.concept_problem_id!, request)
                          }
                          onApprove={(reference) => {
                            if (problem.concept_problem_id != null) {
                              void handleApprove(set.set_id, problem.concept_problem_id, reference);
                            }
                          }}
                          typedActionState={
                            problem.concept_problem_id != null
                              ? typedActionState[problem.concept_problem_id]
                              : undefined
                          }
                          onConfirmTyped={() => {
                            if (problem.concept_problem_id != null) {
                              void handleConfirmTyped(set.set_id, problem.concept_problem_id);
                            }
                          }}
                          onDiscardTyped={() => {
                            if (problem.concept_problem_id != null) {
                              void handleDiscardTyped(set.set_id, problem.concept_problem_id);
                            }
                          }}
                          onEditResubmitTyped={(problemText, solutionText) => {
                            if (problem.concept_problem_id != null) {
                              void handleEditResubmitTyped(
                                set.set_id,
                                problem.concept_problem_id,
                                problemText,
                                solutionText,
                              );
                            }
                          }}
                          concepts={concepts}
                          assignActionState={
                            problem.concept_problem_id != null
                              ? assignActionState[problem.concept_problem_id]
                              : undefined
                          }
                          onAssignConcept={(conceptId) => {
                            if (problem.concept_problem_id != null) {
                              void handleAssignConcept(set.set_id, problem.concept_problem_id, conceptId);
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

function stepContentText(content: Record<string, unknown>): string {
  return Object.entries(content)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' · ');
}

function DraftPreview({ heading, draft }: { heading: string; draft: ReviewDraft }) {
  const steps = Array.isArray(draft.reference_solution) ? draft.reference_solution : [];
  return <ReferenceSolutionPreview heading={heading} steps={steps} />;
}

function ReferenceSolutionPreview({
  heading,
  steps,
}: {
  heading: string;
  steps: ReferenceStep[];
}) {
  return (
    <div className="rounded-xl teacher-panel-soft px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">{heading}</div>
      {steps.length === 0 ? (
        <p className="mt-1 text-xs teacher-muted">No steps recorded in this draft.</p>
      ) : (
        <ol className="mt-1 flex flex-col gap-1">
          {steps.map((step, idx) => (
            <li key={step.id || idx} className="text-xs leading-relaxed">
              <span className="font-semibold">{step.step || idx + 1}.</span>{' '}
              <span className="teacher-muted">[{step.entry_type}]</span>{' '}
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
        {problem.problem_text}{problem.problem_text_truncated ? '…' : ''}
      </p>
    </div>
  );
}

function cloneReferenceSteps(steps: ReferenceStep[] | null | undefined): ReferenceStep[] {
  return (steps ?? []).map((step) => ({
    ...step,
    content: { ...step.content },
    depends_on: [...step.depends_on],
  }));
}

function ProblemEditFields({
  bodyId,
  problemText,
  steps,
  pending,
  error,
  onProblemTextChange,
  onStepStringChange,
  onSave,
  onCancel,
}: {
  bodyId: string;
  problemText: string;
  steps: ReferenceStep[];
  pending: boolean;
  error: string | null;
  onProblemTextChange: (value: string) => void;
  onStepStringChange: (stepIndex: number, key: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${bodyId}-question-edit`} className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide teacher-muted">Question</span>
        <textarea
          id={`${bodyId}-question-edit`}
          required
          rows={5}
          value={problemText}
          disabled={pending}
          onChange={(event) => onProblemTextChange(event.target.value)}
          className="teacher-input rounded-xl px-3 py-2 text-sm disabled:opacity-50"
        />
      </label>

      {steps.length > 0 && (
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
                    const fieldId = `${bodyId}-step-${stepIndex}-content-${contentIndex}`;
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

function TypedConfirmationBody({
  problem,
  pending,
  error,
  onApprove,
  onDiscard,
  onEditResubmit,
}: {
  problem: AuthoredProblemResult;
  pending: boolean;
  error: string | null;
  onApprove: () => void;
  onDiscard: () => void;
  onEditResubmit: (problemText: string, solutionText: string) => void;
}) {
  const draft = problem.confirmation?.draft;
  const diagnostics = problem.confirmation?.diagnostics ?? [];
  const [editing, setEditing] = useState(false);
  const [problemText, setProblemText] = useState(problem.problem_text ?? '');
  const [solutionText, setSolutionText] = useState(draft?.solution ?? '');

  const beginEdit = () => {
    setProblemText(problem.problem_text ?? '');
    setSolutionText(draft?.solution ?? '');
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide teacher-muted">Question</span>
          <textarea
            required
            rows={4}
            value={problemText}
            disabled={pending}
            onChange={(event) => setProblemText(event.target.value)}
            className="teacher-input rounded-xl px-3 py-2 text-sm disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide teacher-muted">
            Answer (optional)
          </span>
          <textarea
            rows={3}
            value={solutionText}
            disabled={pending}
            onChange={(event) => setSolutionText(event.target.value)}
            className="teacher-input rounded-xl px-3 py-2 text-sm disabled:opacity-50"
          />
        </label>
        {error && (
          <div className="rounded-xl teacher-alert teacher-alert--danger px-3 py-1.5 text-xs">
            {error}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !problemText.trim()}
            onClick={() => onEditResubmit(problemText, solutionText)}
            className="teacher-button-primary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {pending && <RefreshCcw className="h-3 w-3 animate-spin" />}
            {pending ? 'Resubmitting…' : 'Resubmit'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing(false)}
            className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <QuestionText problem={problem} />
      {draft && Array.isArray(draft.steps) && (
        <ReferenceSolutionPreview heading="Draft reference solution" steps={draft.steps} />
      )}
      {draft && Array.isArray(draft.edges) && draft.edges.length > 0 && (
        <div className="rounded-xl teacher-panel-soft px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">
            Derived graph edges
          </div>
          <ul className="mt-1 flex flex-col gap-0.5">
            {draft.edges.map((edge, idx) => (
              <li
                key={`${edge.from_node_id}-${edge.to_node_id}-${edge.edge_type}-${idx}`}
                className="text-xs teacher-muted"
              >
                {edge.from_node_id} → {edge.to_node_id}{' '}
                <span className="font-medium">[{edge.edge_type}]</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {draft?.solution && (
        <div className="rounded-xl teacher-panel-soft px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">
            Authored solution
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{draft.solution}</p>
        </div>
      )}
      {diagnostics.length > 0 && (
        <div className="rounded-xl teacher-panel-soft px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">
            Construction notes
          </div>
          <ul className="mt-1 list-disc pl-4 text-xs teacher-muted">
            {diagnostics.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <div className="rounded-xl teacher-alert teacher-alert--danger px-3 py-1.5 text-xs">
          {error}
        </div>
      )}
      <p className="text-xs teacher-muted">
        Review this constructed draft before it becomes teachable.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onApprove}
          className="teacher-button-primary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {pending && <RefreshCcw className="h-3 w-3 animate-spin" />}
          {pending ? 'Approving…' : 'Approve'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={beginEdit}
          className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit & resubmit
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onDiscard}
          className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Discard
        </button>
      </div>
    </>
  );
}

function RehomingFailedBody({
  diagnostic,
  concepts,
  pending,
  error,
  onAssign,
}: {
  diagnostic: string;
  concepts: ConceptOption[];
  pending: boolean;
  error: string | null;
  onAssign: (conceptId: number) => void;
}) {
  const [selected, setSelected] = useState('');

  return (
    <div className="rounded-xl teacher-panel-soft px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">
        Re-homing failed
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">
        {diagnostic || 'Automatic concept tagging could not place this problem.'}
      </p>
      <p className="mt-2 text-xs teacher-muted">
        This problem stays teachable while unassigned. Pick an existing concept to move it there.
      </p>
      {error && (
        <div className="mt-2 rounded-xl teacher-alert teacher-alert--danger px-3 py-1.5 text-xs">
          {error}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          aria-label="Select an existing concept"
          value={selected}
          disabled={pending || concepts.length === 0}
          onChange={(event) => setSelected(event.target.value)}
          className="teacher-input rounded-xl px-3 py-1.5 text-xs disabled:opacity-50"
        >
          <option value="">Select a concept…</option>
          {concepts.map((concept) => (
            <option key={concept.id} value={concept.id}>
              {concept.display_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !selected}
          onClick={() => onAssign(Number(selected))}
          className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {pending && <RefreshCcw className="h-3 w-3 animate-spin" />}
          {pending ? 'Assigning…' : 'Assign'}
        </button>
      </div>
      {concepts.length === 0 && (
        <p className="mt-1 text-xs teacher-muted">No existing concepts found in this course yet.</p>
      )}
    </div>
  );
}

function ProblemRow({
  bodyId,
  problem,
  approveState,
  onApprove,
  onGoToConcepts,
  onSave,
  typedActionState,
  onConfirmTyped,
  onDiscardTyped,
  onEditResubmitTyped,
  concepts,
  assignActionState,
  onAssignConcept,
}: {
  bodyId: string;
  problem: AuthoredProblemResult;
  approveState: ApproveState | undefined;
  onApprove: (reference: 'ocr' | 'generated') => void;
  onGoToConcepts?: () => void;
  onSave: (request: ProblemEditRequest) => Promise<EditedProblemResponse>;
  typedActionState: TypedActionState | undefined;
  onConfirmTyped: () => void;
  onDiscardTyped: () => void;
  onEditResubmitTyped: (problemText: string, solutionText: string) => void;
  concepts: ConceptOption[];
  assignActionState: TypedActionState | undefined;
  onAssignConcept: (conceptId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editProblemText, setEditProblemText] = useState('');
  const [editSteps, setEditSteps] = useState<ReferenceStep[]>([]);
  const [editPending, setEditPending] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const title = problem.label ? `Problem ${problem.label}` : 'Problem';
  const conf =
    problem.ocr_confidence != null ? ` · OCR ${(problem.ocr_confidence * 100).toFixed(0)}%` : '';
  const outcome = effectiveOutcome(problem, approveState);
  const reason = problem.review?.reason ?? problem.reason;
  const pending = approveState?.status === 'pending';
  const review = problem.review;
  const isAwaitingConfirmation = outcome === 'awaiting_teacher_confirmation';
  const isDiscarded = outcome === 'discarded';
  const rehomingFailed = problem.rehoming?.status === 'rehoming_failed';
  const buttons: { reference: 'ocr' | 'generated'; label: string; draft: ReviewDraft | null }[] = [];
  if (outcome === 'held_for_review' && review) {
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
  } else if (outcome === 'held_for_review') {
    // Old response shape (backend not yet deployed): no slot info. reason is
    // still present, so a generated-draft hold gets its one valid button; only
    // genuine extracted-path holds keep both legacy choices.
    buttons.push({ reference: 'ocr', label: 'Approve pipeline draft', draft: null });
    if (reason !== 'generated_no_match') {
      buttons.push({ reference: 'generated', label: 'Use AI-generated', draft: null });
    }
  }

  const approvedByTeacher =
    approveState?.status === 'approved' || Boolean(problem.review?.approved_reference);
  const summary = isDiscarded
    ? 'Discarded'
    : outcome === 'promoted'
      ? approvedByTeacher
        ? 'Approved — now teachable'
        : rehomingFailed
          ? 'Promoted · re-homing failed — needs a concept'
          : `Promoted${problem.solution_source ? ` · ${problem.solution_source}` : ''}${conf}`
      : outcome === 'rejected'
        ? `Rejected${problem.failed_gate != null ? ` · gate ${problem.failed_gate}` : ''}`
        : isAwaitingConfirmation
          ? 'Awaiting your review'
          : `Held · ${holdReasonLabel(reason)}${conf}`;

  const beginEdit = () => {
    setEditProblemText(problem.problem_text ?? '');
    setEditSteps(cloneReferenceSteps(problem.reference_solution));
    setEditError(null);
    setEditing(true);
    setExpanded(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditProblemText(problem.problem_text ?? '');
    setEditSteps(cloneReferenceSteps(problem.reference_solution));
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
    if (problem.concept_problem_id == null) return;
    setEditPending(true);
    setEditError(null);
    try {
      const request: ProblemEditRequest = {};
      if (editProblemText !== (problem.problem_text ?? '')) {
        request.problem_text = editProblemText;
      }
      const originalStepEdits = (problem.reference_solution ?? []).map((step) => ({
        id: step.id,
        content: step.content,
      }));
      const nextStepEdits = editSteps.map((step) => ({ id: step.id, content: step.content }));
      if (JSON.stringify(nextStepEdits) !== JSON.stringify(originalStepEdits)) {
        request.reference_solution = nextStepEdits;
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

  const cardClass =
    outcome === 'held_for_review' || isAwaitingConfirmation || rehomingFailed
      ? 'teacher-alert teacher-alert--warning'
      : outcome === 'rejected'
        ? 'teacher-alert teacher-alert--danger'
        : 'teacher-panel-soft';

  return (
    <div className={`rounded-xl px-3 py-2.5 text-sm ${cardClass}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          {outcome === 'promoted' && !rehomingFailed ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : outcome === 'rejected' ? (
            <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span className="font-medium">{title}</span>
          <span className="teacher-pill teacher-pill--neutral truncate rounded-full px-2 py-0.5 text-xs">
            {summary}
          </span>
        </button>
        {problem.concept_problem_id != null && !isAwaitingConfirmation && !isDiscarded && (
          <button
            type="button"
            aria-expanded={editing}
            aria-label={editing ? `Cancel editing ${title}` : `Edit ${title}`}
            title={editing ? 'Cancel editing' : `Edit ${title}`}
            disabled={editPending}
            onClick={editing ? cancelEdit : beginEdit}
            className="teacher-button-secondary shrink-0 rounded-lg p-1.5 disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div id={bodyId} className="mt-3 flex flex-col gap-2 border-t pt-3">
          {isAwaitingConfirmation ? (
            <TypedConfirmationBody
              problem={problem}
              pending={typedActionState?.status === 'pending'}
              error={typedActionState?.status === 'error' ? typedActionState.message : null}
              onApprove={onConfirmTyped}
              onDiscard={onDiscardTyped}
              onEditResubmit={onEditResubmitTyped}
            />
          ) : isDiscarded ? (
            <p className="text-xs teacher-muted">This draft was discarded.</p>
          ) : (
            <>
              {editing ? (
                <ProblemEditFields
                  bodyId={bodyId}
                  problemText={editProblemText}
                  steps={editSteps}
                  pending={editPending}
                  error={editError}
                  onProblemTextChange={setEditProblemText}
                  onStepStringChange={updateStepString}
                  onSave={() => void saveEdit()}
                  onCancel={cancelEdit}
                />
              ) : (
                <>
                  <QuestionText problem={problem} />
                  {Array.isArray(problem.reference_solution) && (
                    <ReferenceSolutionPreview
                      heading="Reference solution"
                      steps={problem.reference_solution}
                    />
                  )}
                </>
              )}

              {problem.solution_text && (
                <div className="rounded-xl teacher-panel-soft px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">
                    Authored solution
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{problem.solution_text}</p>
                </div>
              )}

              {outcome === 'rejected' && problem.diagnostic && (
                <div className="rounded-xl teacher-panel-soft px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">
                    Diagnostic
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{problem.diagnostic}</p>
                </div>
              )}

              {outcome === 'held_for_review' && problem.confirmation?.status === 'teacher_confirmed_not_promoted' && (
                <div className="rounded-xl teacher-panel-soft px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide teacher-muted">
                    Diagnostic
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {problem.confirmation.diagnostic || 'The solve check could not verify this draft.'}
                  </p>
                </div>
              )}

              {outcome === 'held_for_review' && reason === 'no_matching_concept' && (
                <>
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
                </>
              )}

              {outcome === 'held_for_review' && reason !== 'no_matching_concept' && !problem.confirmation && (
                <>
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
                </>
              )}
            </>
          )}

          {rehomingFailed && (
            <RehomingFailedBody
              diagnostic={problem.rehoming?.diagnostic ?? ''}
              concepts={concepts}
              pending={assignActionState?.status === 'pending'}
              error={assignActionState?.status === 'error' ? assignActionState.message : null}
              onAssign={onAssignConcept}
            />
          )}
        </div>
      )}
    </div>
  );
}
