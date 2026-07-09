"use client";

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

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

export default function ConceptsPanel({
  searchSpaceId,
  accessToken,
}: {
  searchSpaceId: number;
  accessToken: string;
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
    setError(null);
    void fetchConcepts();
  }, [fetchConcepts]);

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
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
