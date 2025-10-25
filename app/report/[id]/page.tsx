"use client";

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'next/navigation';

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
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await fetch(`/api/reports/ai-use/${id}`);
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
    return () => { alive = false; };
  }, [id]);

  const truncated = Boolean(data?.jsonld?.evidence?.truncated);
  const modelNames = ((): string => {
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
    try {
      const resp = await fetch(`/api/reports/ai-use/${id}/pdf`);
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-6 grid md:grid-cols-[1fr_260px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold">AI-use Report</h1>
            <div className="flex gap-2">
              <button onClick={onCopy} className="px-3 py-1.5 rounded-md bg-neutral-800 border border-neutral-700 text-sm">{copyOk ? 'Copied' : 'Copy'}</button>
              <button onClick={downloadMd} className="px-3 py-1.5 rounded-md bg-neutral-800 border border-neutral-700 text-sm">Download .md</button>
              <button onClick={downloadJson} className="px-3 py-1.5 rounded-md bg-neutral-800 border border-neutral-700 text-sm">Download .json</button>
              <button onClick={exportPdf} className="px-3 py-1.5 rounded-md bg-white text-black text-sm rounded-md">Export PDF</button>
            </div>
          </div>

          {truncated && (
            <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-200 p-3 text-sm">
              Warning: This report was generated from a truncated chat; some context may be missing.
            </div>
          )}

          {error && <div className="text-red-400">{error}</div>}
          {!data && !error && <div className="text-neutral-400">Loading…</div>}
          {data?.markdown && (
            <article className="prose prose-invert max-w-none">
              <ReactMarkdown>{data.markdown}</ReactMarkdown>
            </article>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold mb-2">Prompts log</h2>
            <div className="text-sm text-neutral-300">
              {/* If markdown contains anchors like #turn-n, list quick links */}
              {data?.markdown && /\(#turn-\d+\)/i.test(data.markdown) ? (
                <ul className="list-disc pl-6">
                  {[...new Set(Array.from(data.markdown.matchAll(/\(#(turn-[^)]+)\)/g)).map(m => m[1]))].slice(0, 12).map((anc, i) => (
                    <li key={i}><a href={`#${anc}`} className="underline">{anc}</a></li>
                  ))}
                </ul>
              ) : (
                <div className="text-neutral-500">No inline turn anchors found.</div>
              )}
            </div>
          </section>
        </div>

        <aside className="md:sticky md:top-4 h-fit space-y-3">
          <div className="rounded-lg border border-neutral-800 p-3 bg-neutral-900/50">
            <div className="text-xs uppercase tracking-wider text-neutral-400">Metadata</div>
            <div className="mt-2 text-sm space-y-1">
              <div><span className="text-neutral-400">Chat ID:</span> {data?.chat_id}</div>
              <div><span className="text-neutral-400">Created:</span> {data?.created_at}</div>
              <div><span className="text-neutral-400">Model(s):</span> {modelNames}</div>
            </div>
          </div>
          <div className="rounded-lg border border-neutral-800 p-3 bg-neutral-900/50">
            <div className="text-xs uppercase tracking-wider text-neutral-400">Prompt hashes</div>
            <div className="mt-2 text-xs text-neutral-300 break-words">
              {data?.prompt_hashes?.length ? data.prompt_hashes.join(', ') : '—'}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
