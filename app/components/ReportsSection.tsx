"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileText } from 'lucide-react';

export default function ReportsSection() {
  const router = useRouter();
  const [reportId, setReportId] = useState('');

  const open = () => {
    const id = reportId.trim();
    if (!id) return;
    router.push(`/report/${encodeURIComponent(id)}`);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold teacher-section-title">Reports</h1>
        <p className="text-sm teacher-muted">
          AI usage reports are generated from a student&apos;s chat session. Open one by its report ID to review and
          export it.
        </p>
      </header>

      <div className="rounded-3xl teacher-panel-soft p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 teacher-muted" />
          <h2 className="text-lg font-semibold teacher-section-title">Open a report</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') open();
            }}
            placeholder="Report ID"
            className="teacher-input h-10 rounded-2xl px-3 text-sm flex-1 min-w-[12rem] outline-none"
          />
          <button
            type="button"
            onClick={open}
            disabled={!reportId.trim()}
            className="teacher-button-primary h-10 rounded-2xl px-4 text-sm font-semibold inline-flex items-center gap-1.5"
          >
            Open report
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs teacher-muted">
          A report opens in the viewer where you can read the AI-use summary and download it as a PDF.
        </p>
      </div>
    </div>
  );
}
