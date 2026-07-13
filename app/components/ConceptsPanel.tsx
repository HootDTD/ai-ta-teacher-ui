"use client";

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, Loader2, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';

type ConceptSummary = {
  id: number;
  slug: string;
  display_name: string;
  description: string;
  problem_count: number;
  has_teachable_problems: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type GenerationSeed = {
  concept_problem_id: number;
  problem_text: string;
  difficulty: string;
};

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

const GENERATION_UNAVAILABLE = "Problem generation isn't available on this deployment yet.";
const GENERATION_DISABLED = 'Problem generation is disabled for this deployment.';

export default function ConceptsPanel({
  searchSpaceId,
  accessToken,
  onGoToGenerated,
}: {
  searchSpaceId: number;
  accessToken: string;
  onGoToGenerated?: () => void;
}) {
  const [concepts, setConcepts] = useState<ConceptSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [generationConceptId, setGenerationConceptId] = useState<number | null>(null);
  const [generationSeeds, setGenerationSeeds] = useState<GenerationSeed[]>([]);
  const [selectedSeedIds, setSelectedSeedIds] = useState<Set<number>>(new Set());
  const [generationCount, setGenerationCount] = useState(3);
  const [loadingSeeds, setLoadingSeeds] = useState(false);
  const [submittingGeneration, setSubmittingGeneration] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<{
    kind: 'success' | 'error' | 'unavailable';
    text: string;
  } | null>(null);

  const authHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => ({
      Authorization: `Bearer ${accessToken}`,
      ...(extra || {}),
    }),
    [accessToken],
  );

  const fetchConcepts = useCallback(async () => {
    if (!accessToken || !searchSpaceId) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/teacher/concepts?search_space_id=${searchSpaceId}`, {
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error((await resp.text()) || 'Failed to load concepts');
      const data = await resp.json();
      setConcepts(Array.isArray(data?.concepts) ? data.concepts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load concepts');
    } finally {
      setLoading(false);
    }
  }, [accessToken, searchSpaceId, authHeaders]);

  // Reset and reload when the selected class changes.
  useEffect(() => {
    setConcepts([]);
    setEditingId(null);
    setConfirmDeleteId(null);
    setGenerationConceptId(null);
    setGenerationSeeds([]);
    setSelectedSeedIds(new Set());
    setGenerationCount(3);
    setGenerationMessage(null);
    setError(null);
    void fetchConcepts();
  }, [fetchConcepts]);

  const toggleGeneration = async (conceptId: number) => {
    if (generationConceptId === conceptId) {
      setGenerationConceptId(null);
      return;
    }
    setGenerationConceptId(conceptId);
    setGenerationSeeds([]);
    setSelectedSeedIds(new Set());
    setGenerationCount(3);
    setGenerationMessage(null);
    setLoadingSeeds(true);
    try {
      const resp = await fetch(
        `/api/teacher/problem-generation/concepts/${conceptId}/seeds`,
        { headers: authHeaders() },
      );
      if (resp.status === 404) {
        setGenerationMessage({ kind: 'unavailable', text: GENERATION_UNAVAILABLE });
        return;
      }
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Failed to load seed problems'));
      const data = await resp.json();
      const seeds: GenerationSeed[] = Array.isArray(data?.seeds) ? data.seeds : [];
      setGenerationSeeds(seeds);
      setSelectedSeedIds(new Set(seeds.map((seed) => seed.concept_problem_id)));
    } catch (err) {
      setGenerationMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to load seed problems',
      });
    } finally {
      setLoadingSeeds(false);
    }
  };

  const handleGenerate = async (conceptId: number) => {
    if (selectedSeedIds.size === 0) {
      setGenerationMessage({ kind: 'error', text: 'Select at least one seed problem.' });
      return;
    }
    const count = Math.min(10, Math.max(1, generationCount));
    setGenerationCount(count);
    setSubmittingGeneration(true);
    setGenerationMessage(null);
    try {
      const resp = await fetch(
        `/api/teacher/problem-generation/concepts/${conceptId}/variants`,
        {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ seed_problem_ids: Array.from(selectedSeedIds), count }),
        },
      );
      if (resp.status === 403) {
        setGenerationMessage({ kind: 'unavailable', text: GENERATION_DISABLED });
        return;
      }
      if (resp.status === 404) {
        setGenerationMessage({ kind: 'unavailable', text: GENERATION_UNAVAILABLE });
        return;
      }
      if (!resp.ok) throw new Error(await readErrorDetail(resp, 'Failed to start generation'));
      setGenerationMessage({ kind: 'success', text: 'Generation started' });
      onGoToGenerated?.();
    } catch (err) {
      setGenerationMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to start generation',
      });
    } finally {
      setSubmittingGeneration(false);
    }
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      setError('Concept name is required.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const resp = await fetch('/api/teacher/concepts', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          search_space_id: searchSpaceId,
          display_name: name,
          description: newDescription.trim(),
        }),
      });
      if (!resp.ok) throw new Error((await resp.text()) || 'Failed to add concept');
      setNewName('');
      setNewDescription('');
      await fetchConcepts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add concept');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (concept: ConceptSummary) => {
    setEditingId(concept.id);
    setEditName(concept.display_name);
    setEditDescription(concept.description);
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async (conceptId: number) => {
    const name = editName.trim();
    if (!name) {
      setError('Concept name is required.');
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      const resp = await fetch(`/api/teacher/concepts/${conceptId}`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ display_name: name, description: editDescription.trim() }),
      });
      if (!resp.ok) throw new Error((await resp.text()) || 'Failed to save concept');
      setEditingId(null);
      await fetchConcepts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save concept');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (conceptId: number) => {
    setDeletingId(conceptId);
    setError(null);
    try {
      const resp = await fetch(`/api/teacher/concepts/${conceptId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error((await resp.text()) || 'Failed to delete concept');
      setConfirmDeleteId(null);
      await fetchConcepts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete concept');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-2xl teacher-alert teacher-alert--danger px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Add form */}
      <div className="rounded-2xl teacher-panel-subtle p-4 flex flex-col gap-3">
        <span className="text-sm font-semibold">Add a concept</span>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Concept name — e.g. Entity Relationship Diagrams"
          className="teacher-input rounded-xl px-3 py-2 text-sm"
          maxLength={200}
        />
        <textarea
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Short description (optional) — helps Hoot match uploaded problems to this concept"
          className="teacher-input rounded-xl px-3 py-2 text-sm min-h-20"
          maxLength={4000}
        />
        <div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="inline-flex items-center gap-2 rounded-2xl teacher-button-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add concept
          </button>
        </div>
      </div>

      {/* Concept list */}
      {loading && concepts.length === 0 ? (
        <p className="text-sm teacher-muted">Loading concepts…</p>
      ) : concepts.length === 0 ? (
        <p className="text-sm teacher-muted">
          No concepts yet. Add the topics you want students to teach back — problem sets you
          upload later are matched against this list.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {concepts.map((concept) => (
            <li key={concept.id} className="rounded-2xl teacher-panel-soft px-4 py-3">
              {editingId === concept.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="teacher-input rounded-xl px-3 py-2 text-sm"
                    maxLength={200}
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="teacher-input rounded-xl px-3 py-2 text-sm min-h-20"
                    maxLength={4000}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit(concept.id)}
                      disabled={savingEdit || !editName.trim()}
                      className="inline-flex items-center gap-1.5 rounded-2xl teacher-button-primary px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                    >
                      {savingEdit ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="inline-flex items-center gap-1.5 rounded-2xl teacher-button-secondary px-3 py-1.5 text-sm font-semibold"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{concept.display_name}</span>
                      <span className="text-xs teacher-muted">{concept.slug}</span>
                      {concept.problem_count > 0 && (
                        <span className="teacher-pill teacher-pill--neutral px-2 py-0.5 text-xs">
                          {concept.problem_count} problem{concept.problem_count === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    {concept.description && (
                      <p className="mt-1 text-sm teacher-muted">{concept.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {concept.has_teachable_problems && (
                      <button
                        type="button"
                        onClick={() => void toggleGeneration(concept.id)}
                        aria-expanded={generationConceptId === concept.id}
                        className="inline-flex items-center gap-1.5 rounded-xl teacher-button-secondary px-2.5 py-2 text-xs font-semibold"
                      >
                        <Sparkles className="h-4 w-4" />
                        Generate variants
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${
                            generationConceptId === concept.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(concept)}
                      aria-label={`Edit ${concept.display_name}`}
                      className="inline-flex items-center rounded-xl teacher-button-secondary p-2"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {confirmDeleteId === concept.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleDelete(concept.id)}
                          disabled={deletingId === concept.id}
                          className="inline-flex items-center gap-1.5 rounded-xl teacher-alert teacher-alert--danger px-2.5 py-2 text-xs font-semibold"
                        >
                          {deletingId === concept.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          aria-label="Cancel delete"
                          className="inline-flex items-center rounded-xl teacher-button-secondary p-2"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(concept.id)}
                        disabled={concept.problem_count > 0}
                        title={
                          concept.problem_count > 0
                            ? 'This concept has problems attached — delete its problem sets first.'
                            : undefined
                        }
                        aria-label={`Delete ${concept.display_name}`}
                        className="inline-flex items-center rounded-xl teacher-button-secondary p-2 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {generationConceptId === concept.id && (
                  <div className="mt-3 rounded-2xl teacher-panel-subtle p-4 flex flex-col gap-3">
                    <div>
                      <div className="text-sm font-semibold">Generate problem variants</div>
                      <p className="mt-0.5 text-xs teacher-muted">
                        Choose teachable problems to use as seeds, then set how many variants to create.
                      </p>
                    </div>

                    {loadingSeeds && (
                      <div className="flex items-center gap-2 text-sm teacher-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading seed problems…
                      </div>
                    )}

                    {generationMessage && (
                      <div
                        className={`rounded-xl px-3 py-2 text-sm ${
                          generationMessage.kind === 'success'
                            ? 'teacher-alert teacher-alert--success'
                            : generationMessage.kind === 'error'
                              ? 'teacher-alert teacher-alert--danger'
                              : 'teacher-panel-soft teacher-muted'
                        }`}
                      >
                        {generationMessage.text}
                      </div>
                    )}

                    {!loadingSeeds &&
                      generationMessage?.kind !== 'unavailable' &&
                      generationSeeds.length === 0 && (
                        <p className="text-sm teacher-muted">
                          No teachable seed problems are available for this concept.
                        </p>
                      )}

                    {generationSeeds.length > 0 && generationMessage?.kind !== 'unavailable' && (
                      <>
                        <div className="flex flex-col gap-2">
                          {generationSeeds.map((seed) => (
                            <label
                              key={seed.concept_problem_id}
                              className="flex cursor-pointer items-start gap-2 rounded-xl teacher-panel-soft px-3 py-2"
                            >
                              <input
                                type="checkbox"
                                checked={selectedSeedIds.has(seed.concept_problem_id)}
                                disabled={submittingGeneration}
                                onChange={(event) => {
                                  setSelectedSeedIds((current) => {
                                    const next = new Set(current);
                                    if (event.target.checked) next.add(seed.concept_problem_id);
                                    else next.delete(seed.concept_problem_id);
                                    return next;
                                  });
                                }}
                                className="mt-0.5 h-4 w-4"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 text-sm" title={seed.problem_text}>
                                  {seed.problem_text}
                                </span>
                                <span className="mt-0.5 block text-xs teacher-muted">
                                  {seed.difficulty}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                          <label className="flex flex-col gap-1 text-xs teacher-muted">
                            Variant count
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={generationCount}
                              disabled={submittingGeneration}
                              onChange={(event) =>
                                setGenerationCount(Number.parseInt(event.target.value, 10) || 1)
                              }
                              className="teacher-input h-9 w-24 rounded-xl px-3 text-sm"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => void handleGenerate(concept.id)}
                            disabled={submittingGeneration || selectedSeedIds.size === 0}
                            className="teacher-button-primary h-9 rounded-xl px-3 text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            {submittingGeneration ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            {submittingGeneration ? 'Starting…' : 'Generate'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
