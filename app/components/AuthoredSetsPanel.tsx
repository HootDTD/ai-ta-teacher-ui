"use client";

import { useCallback, useEffect, useState } from 'react';
import { UploadCloud, RefreshCcw, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

type AuthoredStatus = 'pending' | 'indexing' | 'provisioning' | 'done' | 'failed';

type AuthoredSetSummary = {
  set_id: number;
  set_index: number;
  status: AuthoredStatus;
  problem_document_id: number | null;
  solution_document_id: number | null;
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
};

type AuthoredSetDetail = AuthoredSetSummary & {
  result_summary: {
    problems?: AuthoredProblemResult[];
    counts?: Record<string, number>;
    error?: string;
  };
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
}: {
  searchSpaceId: number;
  accessToken: string;
}) {
  const [sets, setSets] = useState<AuthoredSetSummary[]>([]);
  const [details, setDetails] = useState<Record<number, AuthoredSetDetail>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [problemFile, setProblemFile] = useState<File | null>(null);
  const [solutionFile, setSolutionFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
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
      if (!resp.ok) throw new Error((await resp.text()) || 'Failed to load authored sets');
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
        if (!resp.ok) throw new Error((await resp.text()) || 'Failed to load set detail');
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
    if (!problemFile || !solutionFile) {
      setError('Select both a problem PDF and a solution PDF.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('search_space_id', String(searchSpaceId));
      fd.append('problem', problemFile);
      fd.append('solution', solutionFile);
      const resp = await fetch('/api/teacher/authored-sets', {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      if (!resp.ok) throw new Error((await resp.text()) || 'Upload failed');
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
      if (!resp.ok) throw new Error((await resp.text()) || 'Delete failed');
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
    setApprovingId(problemId);
    setError(null);
    try {
      const resp = await fetch(`/api/teacher/authored-sets/${setId}/problems/${problemId}/approve`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reference }),
      });
      if (!resp.ok) throw new Error((await resp.text()) || 'Approve failed');
      await fetchDetail(setId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="rounded-3xl teacher-panel-soft p-5">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold teacher-section-title">Authored problem sets</div>
        <span className="rounded-full teacher-pill px-3 py-1 text-xs">Paired PDFs</span>
      </div>
      <p className="mt-1 text-sm teacher-muted">
        Upload a problem PDF and its matching solution PDF. Each problem is grounded against only
        its paired solution; low-confidence (e.g. handwritten) extractions are held for your review.
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
            label="Solution PDF"
            file={solutionFile}
            disabled={uploading}
            onPick={setSolutionFile}
          />
        </div>
        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={uploading || !problemFile || !solutionFile}
          className="teacher-button-primary h-10 rounded-2xl px-4 text-sm font-semibold self-start inline-flex items-center gap-2 disabled:opacity-50"
        >
          <UploadCloud className="h-4 w-4" />
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
          const counts = detail?.result_summary?.counts;
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
                    <div className="text-sm teacher-muted">Loading…</div>
                  )}
                  {detail?.result_summary?.problems?.length === 0 && set.status === 'done' && (
                    <div className="text-sm teacher-muted">No problems were scraped from this set.</div>
                  )}
                  <div className="flex flex-col gap-2">
                    {(detail?.result_summary?.problems ?? []).map((problem, idx) => (
                      <ProblemRow
                        key={problem.concept_problem_id ?? idx}
                        problem={problem}
                        approving={approvingId === problem.concept_problem_id}
                        onApprove={(reference) => {
                          if (problem.concept_problem_id != null) {
                            void handleApprove(set.set_id, problem.concept_problem_id, reference);
                          }
                        }}
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

function ProblemRow({
  problem,
  approving,
  onApprove,
}: {
  problem: AuthoredProblemResult;
  approving: boolean;
  onApprove: (reference: 'ocr' | 'generated') => void;
}) {
  const title = problem.label ? `Problem ${problem.label}` : 'Problem';
  const conf =
    problem.ocr_confidence != null ? ` · OCR ${(problem.ocr_confidence * 100).toFixed(0)}%` : '';

  if (problem.outcome === 'promoted') {
    return (
      <div className="flex items-center gap-2 rounded-xl teacher-panel-soft px-3 py-2 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <span className="font-medium">{title}</span>
        <span className="teacher-muted">promoted ({problem.solution_source}{conf})</span>
      </div>
    );
  }

  if (problem.outcome === 'rejected') {
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

  // held_for_review — teacher chooses which reference to promote.
  return (
    <div className="rounded-xl teacher-alert teacher-alert--warning px-3 py-2.5 text-sm flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="font-medium">{title}</span>
        <span className="teacher-muted">held for review · {problem.reason || 'needs a decision'}{conf}</span>
      </div>
      <p className="text-xs teacher-muted">
        Choose which reference solution to promote as teachable.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={approving}
          onClick={() => onApprove('ocr')}
          className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {approving ? 'Approving…' : 'Use extracted (OCR)'}
        </button>
        <button
          type="button"
          disabled={approving}
          onClick={() => onApprove('generated')}
          className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {approving ? 'Approving…' : 'Use AI-generated'}
        </button>
      </div>
    </div>
  );
}
