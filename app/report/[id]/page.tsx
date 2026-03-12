"use client";

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'next/navigation';
import {
  clearStoredSession,
  ensureActiveSession,
  loadStoredSession,
  saveStoredSession,
  type StoredSession,
} from '../../lib/auth';

type Report = {
  id: string;
  chat_id: string;
  created_at: string;
  style?: string;
  length?: string;
  markdown?: string;
  jsonld?: { evidence?: { truncated?: boolean } } | null;
  model_fingerprint?: string;
  prompt_hashes?: string[];
};

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await ensureActiveSession(loadStoredSession());
      if (cancelled) return;
      if (active) {
        saveStoredSession(active);
        setSession(active);
      } else {
        clearStoredSession();
        setSession(null);
      }
      setAuthReady(true);
    })().catch((err: unknown) => {
      if (cancelled) return;
      const msg = err instanceof Error ? err.message : 'Failed to initialize auth session.';
      setAuthError(msg);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!session?.access_token) {
      setError('Sign in is required to view reports.');
      setData(null);
      return;
    }
    setError(null);
    let alive = true;
    (async () => {
      try {
        const resp = await fetch(`/api/reports/ai-use/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const j = (await resp.json()) as Report;
        if (alive) setData(j);
      } catch (e: unknown) {
        if (alive) {
          const message = e instanceof Error ? e.message : 'Failed to load';
          setError(message);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [authReady, id, session?.access_token]);

  const truncated = Boolean(data?.jsonld?.evidence?.truncated);
  const modelNames = (() => {
    const jf = data?.model_fingerprint || '';
    if (!jf) return 'unknown';
    return jf;
  })();

  const onCopy = async () => {
    if (!data?.markdown) return;
    await navigator.clipboard.writeText(data.markdown);
    setCopyOk(true);
    setTimeout(() => setCopyOk(false), 1500);
  };

  const downloadMd = () => {
    if (!data?.markdown) return;
    const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ai-use-report-${id}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ai-use-report-${id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportPdf = async () => {
    if (!session?.access_token) {
      alert('Sign in is required to export reports.');
      return;
    }
    try {
      const resp = await fetch(`/api/reports/ai-use/${id}/pdf`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        alert(`Export failed (HTTP ${resp.status})${txt ? `: ${txt}` : ''}`);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-use-report-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    }
  };

  return (
    <div className="min-h-screen teacher-shell">
      <div className="mx-auto max-w-5xl px-4 py-6 grid md:grid-cols-[1fr_260px] gap-6">
        <div>
          {authError && (
            <div className="mb-3 rounded-md teacher-alert teacher-alert--danger p-3 text-sm">
              {authError}
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold teacher-section-title">AI-use Report</h1>
            <div className="flex gap-2">
              <button onClick={onCopy} className="teacher-button-secondary px-3 py-1.5 rounded-md text-sm">
                {copyOk ? 'Copied' : 'Copy'}
              </button>
              <button onClick={downloadMd} className="teacher-button-secondary px-3 py-1.5 rounded-md text-sm">
                Download .md
              </button>
              <button onClick={downloadJson} className="teacher-button-secondary px-3 py-1.5 rounded-md text-sm">
                Download .json
              </button>
              <button onClick={exportPdf} className="teacher-button-primary px-3 py-1.5 rounded-md text-sm">
                Export PDF
              </button>
            </div>
          </div>

          {truncated && (
            <div className="mb-3 rounded-md teacher-alert teacher-alert--warning p-3 text-sm">
              Warning: This report was generated from a truncated chat; some context may be missing.
            </div>
          )}

          {error && <div className="teacher-danger-text">{error}</div>}
          {!data && !error && <div className="teacher-muted">{authReady ? 'Loading…' : 'Checking session…'}</div>}
          {data?.markdown && (
            <article className="teacher-prose max-w-none">
              <ReactMarkdown>{data.markdown}</ReactMarkdown>
            </article>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold mb-2 teacher-section-title">Prompts log</h2>
            <div className="text-sm teacher-muted">
              {data?.markdown && /\(#turn-\d+\)/i.test(data.markdown) ? (
                <ul className="list-disc pl-6">
                  {[...new Set(Array.from(data.markdown.matchAll(/\(#(turn-[^)]+)\)/g)).map((m) => m[1]))]
                    .slice(0, 12)
                    .map((anc, i) => (
                      <li key={i}>
                        <a href={`#${anc}`} className="teacher-link">{anc}</a>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="teacher-muted">No inline turn anchors found.</div>
              )}
            </div>
          </section>
        </div>

        <aside className="md:sticky md:top-4 h-fit space-y-3">
          <div className="rounded-lg teacher-panel-soft p-3">
            <div className="text-xs uppercase tracking-wider teacher-muted">Metadata</div>
            <div className="mt-2 text-sm space-y-1">
              <div><span className="teacher-muted">Chat ID:</span> {data?.chat_id}</div>
              <div><span className="teacher-muted">Created:</span> {data?.created_at}</div>
              <div><span className="teacher-muted">Model(s):</span> {modelNames}</div>
            </div>
          </div>
          <div className="rounded-lg teacher-panel-soft p-3">
            <div className="text-xs uppercase tracking-wider teacher-muted">Prompt hashes</div>
            <div className="mt-2 text-xs teacher-muted break-words">
              {data?.prompt_hashes?.length ? data.prompt_hashes.join(', ') : '—'}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
