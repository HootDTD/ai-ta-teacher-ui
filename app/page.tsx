"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Calendar, CheckCircle2, RefreshCcw, UploadCloud } from 'lucide-react';

const CLASS_OPTIONS = [
  { value: 'AAE 33300: Introduction to Fluid Mechanics', label: 'AAE 33300: Introduction to Fluid Mechanics' },
];

const WEEK_KINDS = {
  notes: 'Course Notes',
  slides: 'Course Slides',
} as const;

type WeekKind = keyof typeof WEEK_KINDS;

type UploadSummary = {
  id: string;
  week: number;
  kind: WeekKind;
  title: string;
  uploaded_at?: string;
  source_name?: string;
  page_count?: number;
  index_path?: string;
  doc_id?: string;
};

type SectionState = {
  latest: UploadSummary | null;
  history: UploadSummary[];
};

type WeekState = {
  week: number;
  notes: SectionState;
  slides: SectionState;
};

type CourseState = {
  course: string;
  slug: string;
  current_week: number;
  weeks: WeekState[];
};

const MAX_WEEKS = 16;

const formatDate = (value?: string) => {
  if (!value) return 'Unknown date';
  try {
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function TeacherConsole() {
  const [selectedClass, setSelectedClass] = useState<string>(CLASS_OPTIONS[0]?.value ?? '');
  const [courseState, setCourseState] = useState<CourseState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [savingWeek, setSavingWeek] = useState<boolean>(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [pendingWeek, setPendingWeek] = useState<number>(1);

  const fetchWeeks = useCallback(async (course: string) => {
    if (!course) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/teacher/weeks?class=${encodeURIComponent(course)}`, { cache: 'no-store' });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to load weekly uploads');
      }
      const data = (await resp.json()) as CourseState;
      setCourseState(data);
      setPendingWeek(data.current_week);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load weekly uploads';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeeks(selectedClass);
  }, [selectedClass, fetchWeeks]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const handleCurrentWeekSave = async () => {
    if (!courseState) return;
    if (pendingWeek === courseState.current_week) return;
    setSavingWeek(true);
    setError(null);
    try {
      const resp = await fetch('/api/teacher/current-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class: selectedClass, current_week: pendingWeek }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to update current week');
      }
      const data = (await resp.json()) as CourseState;
      setCourseState(data);
      setFlash(`Current week set to ${pendingWeek}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update current week';
      setError(msg);
    } finally {
      setSavingWeek(false);
    }
  };

  const handleUpload = async (file: File | null, week: number, kind: WeekKind) => {
    if (!file || !selectedClass) return;
    const key = `${week}-${kind}`;
    setUploadingKey(key);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('class', selectedClass);
      formData.append('week', String(week));
      formData.append('kind', kind);
      formData.append('title', `${WEEK_KINDS[kind]} · Week ${week}`);
      formData.append('file', file);
      const resp = await fetch('/api/teacher/upload', {
        method: 'POST',
        body: formData,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Upload failed');
      }
      await fetchWeeks(selectedClass);
      setFlash(`${WEEK_KINDS[kind]} for week ${week} uploaded.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    } finally {
      setUploadingKey(null);
    }
  };

  const weeks = useMemo(() => courseState?.weeks ?? [], [courseState]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="border-b border-neutral-800 sticky top-0 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/70">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="font-semibold tracking-tight">Hoot • Teacher Console</div>
          <div className="text-xs text-neutral-400">Upload slides + notes → PNG + embeddings</div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6 space-y-4">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <label className="flex flex-col text-sm text-neutral-300">
              <span className="text-xs uppercase tracking-wide text-neutral-400">Class</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="mt-1 h-11 rounded-2xl border border-neutral-800 bg-neutral-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-600"
              >
                {CLASS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="w-full md:w-auto">
              <div className="flex items-end gap-3">
                <label className="flex flex-col text-sm text-neutral-300">
                  <span className="text-xs uppercase tracking-wide text-neutral-400">Current Week</span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_WEEKS}
                    value={pendingWeek}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isNaN(value)) {
                        setPendingWeek(1);
                        return;
                      }
                      const clamped = Math.min(MAX_WEEKS, Math.max(1, value));
                      setPendingWeek(clamped);
                    }}
                    className="mt-1 h-11 w-28 rounded-2xl border border-neutral-800 bg-neutral-900 px-3 text-center text-lg focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  />
                </label>
                <button
                  onClick={handleCurrentWeekSave}
                  disabled={savingWeek || !courseState || pendingWeek === courseState.current_week}
                  className="h-11 rounded-2xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-40"
                >
                  {savingWeek ? 'Saving…' : 'Update'}
                </button>
              </div>
              <p className="mt-2 text-xs text-neutral-500 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                Students see only the uploads from the active week.
              </p>
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Upload PDFs for course notes and slides each week. We automatically render every page to PNG, run OCR, and embed the text separate from the textbook index so the assistant can reference only what is relevant for the current week.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}
        {flash && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
            {flash}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 px-4 py-6 text-sm text-neutral-400">
            Loading weekly timeline…
          </div>
        )}

        <div className="space-y-4">
          {weeks.map((week) => (
            <motion.div
              key={week.week}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-3xl border border-neutral-800 bg-neutral-900/20 p-5"
            >
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Week {week.week}</div>
                {courseState?.current_week === week.week && (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">Active week</span>
                )}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(Object.keys(WEEK_KINDS) as WeekKind[]).map((kind) => {
                  const section = kind === 'notes' ? week.notes : week.slides;
                  const latest = section.latest;
                  const uploading = uploadingKey === `${week.week}-${kind}`;
                  const previous = section.history.filter((entry) => entry.id !== latest?.id).slice(0, 2);
                  return (
                    <div key={kind} className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-neutral-400">{WEEK_KINDS[kind]}</p>
                          <p className="text-lg font-semibold">{latest ? latest.title : 'No upload yet'}</p>
                        </div>
                        {latest ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-amber-400" />}
                      </div>
                      <p className="text-sm text-neutral-400">
                        {latest
                          ? `Uploaded ${formatDate(latest.uploaded_at)} · ${latest.page_count ? `${latest.page_count} pages` : 'page count pending'}`
                          : 'Upload a PDF to unlock this context for the AI.'}
                      </p>
                      {latest && (
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/30 p-3 text-xs text-neutral-400 space-y-1">
                          <div>Filename: {latest.source_name || '—'}</div>
                          <div>Doc ID: {latest.doc_id || '—'}</div>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-semibold hover:border-neutral-500">
                          <UploadCloud className="h-4 w-4" />
                          {uploading ? 'Uploading…' : 'Upload PDF'}
                          <input
                            type="file"
                            accept="application/pdf"
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              handleUpload(file, week.week, kind);
                              event.target.value = '';
                            }}
                          />
                        </label>
                        <div className="text-xs text-neutral-500 flex items-center gap-2">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Auto-converts to PNG + embeddings
                        </div>
                      </div>
                      {previous.length > 0 && (
                        <div className="text-xs text-neutral-500">
                          Previous uploads:
                          <ul className="mt-1 space-y-0.5">
                            {previous.map((entry) => (
                              <li key={entry.id}>
                                {entry.source_name || entry.title} · {formatDate(entry.uploaded_at)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
