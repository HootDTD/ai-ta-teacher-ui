"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronDown, RefreshCcw, UploadCloud } from 'lucide-react';
import {
  WEEK_KINDS,
  MAX_WEEKS,
  isPendingStatus,
  type CourseState,
  type UploadSummary,
  type WeekKind,
  type WeekState,
} from '../lib/teacher';

type Props = {
  courseState: CourseState | null;
  loading: boolean;
  pendingWeek: number;
  onPendingWeekChange: (week: number) => void;
  savingWeek: boolean;
  onSaveCurrentWeek: () => void;
  hasPendingUploads: boolean;
  uploadingKey: string | null;
  retryingUploadId: string | null;
  onUpload: (file: File | null, week: number, kind: WeekKind) => void;
  onUploadTextbook: (file: File | null) => void;
  onRetry: (upload: UploadSummary) => void;
};

function UploadSlot({
  section,
  label,
  uploading,
  retryingUploadId,
  onPick,
  onRetry,
}: {
  section: { latest: UploadSummary | null; history: UploadSummary[] };
  label: string;
  uploading: boolean;
  retryingUploadId: string | null;
  onPick: (file: File | null) => void;
  onRetry: (upload: UploadSummary) => void;
}) {
  const latest = section.latest;
  const pendingAttempt =
    section.history.find((entry) => entry.id !== latest?.id && isPendingStatus(entry.status)) ?? null;
  const failedAttempt =
    section.history.find((entry) => entry.id !== latest?.id && entry.status === 'failed') ??
    (!latest ? section.history.find((entry) => entry.status === 'failed') ?? null : null);

  return (
    <div className="rounded-2xl teacher-panel-subtle p-4 flex flex-col gap-3">
      <div className="text-xs uppercase tracking-wide teacher-muted">{label}</div>
      {latest ? (
        <div className="text-sm teacher-muted">
          {latest.source_name || latest.title} · {latest.page_count ? `${latest.page_count} pages` : 'Processing'}
        </div>
      ) : (
        <div className="text-sm teacher-muted">Nothing uploaded yet.</div>
      )}
      {pendingAttempt && (
        <div className="rounded-2xl teacher-alert teacher-alert--warning px-3 py-2 text-sm flex items-center gap-2">
          <RefreshCcw className="h-4 w-4 animate-spin" />
          {latest ? 'New version processing…' : 'Processing…'}
        </div>
      )}
      {failedAttempt && !pendingAttempt && (
        <div className="rounded-2xl teacher-alert teacher-alert--danger px-3 py-2 text-sm flex items-center justify-between gap-2">
          <span>
            {latest ? 'Replacement failed' : 'Upload failed'}
            {failedAttempt.error_message ? ` — ${failedAttempt.error_message}` : ''}
          </span>
          <button
            type="button"
            onClick={() => onRetry(failedAttempt)}
            disabled={retryingUploadId === failedAttempt.id}
            className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold"
          >
            {retryingUploadId === failedAttempt.id ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl teacher-button-secondary px-3 py-2 text-sm font-semibold self-start">
        <UploadCloud className="h-4 w-4" />
        {uploading ? 'Uploading…' : latest ? `Replace ${label}` : `Upload ${label}`}
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            onPick(file);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

function WeekRow({
  week,
  isActiveWeek,
  expanded,
  onToggle,
  uploadingKey,
  retryingUploadId,
  onUpload,
  onRetry,
}: {
  week: WeekState;
  isActiveWeek: boolean;
  expanded: boolean;
  onToggle: () => void;
  uploadingKey: string | null;
  retryingUploadId: string | null;
  onUpload: (file: File | null, week: number, kind: WeekKind) => void;
  onRetry: (upload: UploadSummary) => void;
}) {
  const kinds = Object.keys(WEEK_KINDS) as WeekKind[];
  const summary = kinds.map((kind) => {
    const section = kind === 'notes' ? week.notes : week.slides;
    return { kind, present: Boolean(section.latest) };
  });

  return (
    <div className="rounded-3xl teacher-panel-soft overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base font-semibold teacher-section-title whitespace-nowrap">Week {week.week}</span>
          {isActiveWeek && (
            <span className="rounded-full teacher-pill teacher-pill--success px-2.5 py-0.5 text-xs whitespace-nowrap">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {summary.map(({ kind, present }) => (
            <span
              key={kind}
              className={`rounded-full px-2.5 py-0.5 text-xs ${present ? 'teacher-pill teacher-pill--success' : 'teacher-pill teacher-pill--neutral'}`}
            >
              {kind === 'notes' ? 'Notes' : 'Slides'} {present ? '✓' : '—'}
            </span>
          ))}
          <ChevronDown
            className={`h-4 w-4 teacher-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.18 }}
          className="px-5 pb-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {kinds.map((kind) => {
              const section = kind === 'notes' ? week.notes : week.slides;
              return (
                <UploadSlot
                  key={kind}
                  section={section}
                  label={kind === 'notes' ? 'Notes' : 'Slides'}
                  uploading={uploadingKey === `${week.week}-${kind}`}
                  retryingUploadId={retryingUploadId}
                  onPick={(file) => onUpload(file, week.week, kind)}
                  onRetry={onRetry}
                />
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function MaterialsSection({
  courseState,
  loading,
  pendingWeek,
  onPendingWeekChange,
  savingWeek,
  onSaveCurrentWeek,
  hasPendingUploads,
  uploadingKey,
  retryingUploadId,
  onUpload,
  onUploadTextbook,
  onRetry,
}: Props) {
  const currentWeek = courseState?.current_week;
  const weeks = courseState?.weeks ?? [];
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  // Open the active week by default; keep the rest collapsed so teachers aren't
  // staring at every week's upload slots at once.
  useEffect(() => {
    if (typeof currentWeek === 'number') {
      setExpandedWeeks(new Set([currentWeek]));
    }
  }, [currentWeek]);

  const toggleWeek = (week: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  };

  const textbook = courseState?.textbook ?? { latest: null, history: [] };
  const textbookLatest = textbook.latest;
  const textbookPending =
    textbook.history.find((entry) => entry.id !== textbookLatest?.id && isPendingStatus(entry.status)) ?? null;
  const textbookFailed =
    textbook.history.find((entry) => entry.id !== textbookLatest?.id && entry.status === 'failed') ??
    (!textbookLatest ? textbook.history.find((entry) => entry.status === 'failed') ?? null : null);
  const textbookUploading = uploadingKey === 'textbook';

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold teacher-section-title">Course materials</h1>
        <p className="text-sm teacher-muted">
          Set the active week, upload the course textbook, and add notes and slides week by week.
        </p>
      </header>

      {hasPendingUploads && (
        <div className="rounded-2xl teacher-alert teacher-alert--warning px-4 py-3 text-sm flex items-center gap-2">
          <RefreshCcw className="h-4 w-4 animate-spin" />
          Uploads are being processed. This page updates automatically.
        </div>
      )}

      {/* Active week control */}
      <div className="rounded-3xl teacher-panel p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide teacher-muted mb-1">Active week</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={MAX_WEEKS}
                value={pendingWeek}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isNaN(value)) {
                    onPendingWeekChange(1);
                    return;
                  }
                  onPendingWeekChange(Math.min(MAX_WEEKS, Math.max(1, value)));
                }}
                className="teacher-input h-10 w-16 rounded-2xl px-2 text-center text-sm"
              />
              <button
                onClick={onSaveCurrentWeek}
                disabled={savingWeek || !courseState || pendingWeek === courseState.current_week}
                className="teacher-button-primary h-10 rounded-2xl px-4 text-sm font-semibold"
              >
                {savingWeek ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>
          <p className="text-xs teacher-muted flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Students see uploads through the active week.
          </p>
        </div>
      </div>

      {/* Course textbook */}
      <div className="rounded-3xl teacher-panel-soft p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold teacher-section-title">Course textbook</h2>
          <span className="rounded-full teacher-pill px-3 py-1 text-xs">All weeks</span>
        </div>
        <p className="mt-1 text-sm teacher-muted">
          The textbook is searched for every question in this course, regardless of the active week.
        </p>
        <div className="mt-4 rounded-2xl teacher-panel-subtle p-4 flex flex-col gap-3">
          <div className="text-sm teacher-muted">
            {textbookLatest
              ? `${textbookLatest.source_name || textbookLatest.title} · ${textbookLatest.page_count ? `${textbookLatest.page_count} pages` : 'Processing'}`
              : 'No textbook uploaded yet.'}
          </div>
          {textbookPending && (
            <div className="rounded-2xl teacher-alert teacher-alert--warning px-3 py-2 text-sm flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 animate-spin" />
              {textbookLatest ? 'New textbook processing…' : 'Processing…'}
            </div>
          )}
          {textbookFailed && !textbookPending && (
            <div className="rounded-2xl teacher-alert teacher-alert--danger px-3 py-2 text-sm flex items-center justify-between gap-2">
              <span>
                {textbookLatest ? 'Replacement failed' : 'Upload failed'}
                {textbookFailed.error_message ? ` — ${textbookFailed.error_message}` : ''}
              </span>
              <button
                type="button"
                onClick={() => onRetry(textbookFailed)}
                disabled={retryingUploadId === textbookFailed.id}
                className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                {retryingUploadId === textbookFailed.id ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl teacher-button-secondary px-3 py-2 text-sm font-semibold self-start">
            <UploadCloud className="h-4 w-4" />
            {textbookUploading ? 'Uploading…' : textbookLatest ? 'Replace textbook' : 'Upload textbook'}
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                onUploadTextbook(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {/* Weekly timeline */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold teacher-section-title">Weekly materials</h2>
          <span className="text-xs teacher-muted">{weeks.length} weeks</span>
        </div>
        {loading && weeks.length === 0 ? (
          <div className="rounded-2xl teacher-panel-soft px-4 py-6 text-sm teacher-muted flex items-center gap-3">
            <span className="boot-screen__bar" />
            Loading weekly timeline…
          </div>
        ) : (
          <div className="space-y-3">
            {weeks.map((week) => (
              <WeekRow
                key={week.week}
                week={week}
                isActiveWeek={currentWeek === week.week}
                expanded={expandedWeeks.has(week.week)}
                onToggle={() => toggleWeek(week.week)}
                uploadingKey={uploadingKey}
                retryingUploadId={retryingUploadId}
                onUpload={onUpload}
                onRetry={onRetry}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
