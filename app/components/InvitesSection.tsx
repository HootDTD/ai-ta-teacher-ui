"use client";

import { ClipboardCopy, Link2, RefreshCcw, Trash2 } from 'lucide-react';
import type { InviteLink } from '../lib/teacher';

type Props = {
  loadingInvites: boolean;
  activeStudentLink: InviteLink | null;
  activeTeacherLink: InviteLink | null;
  generatingInvite: string | null;
  copiedCode: string | null;
  getInviteUrl: (code: string, role: 'student' | 'teacher') => string;
  onGenerate: (role: 'student' | 'teacher') => void;
  onCopy: (code: string, role: 'student' | 'teacher') => void;
  onRevoke: (linkId: number) => void;
};

const ROLE_COPY: Record<'student' | 'teacher', { title: string; blurb: string }> = {
  student: {
    title: 'Student invite',
    blurb: 'Share this link so students can join the class and chat with the AI tutor.',
  },
  teacher: {
    title: 'Teacher invite',
    blurb: 'Share this link with co-instructors to give them dashboard access.',
  },
};

export default function InvitesSection({
  loadingInvites,
  activeStudentLink,
  activeTeacherLink,
  generatingInvite,
  copiedCode,
  getInviteUrl,
  onGenerate,
  onCopy,
  onRevoke,
}: Props) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold teacher-section-title">Invites</h1>
        <p className="text-sm teacher-muted">
          Generate join links for students and co-instructors. One active link per role.
        </p>
      </header>

      {loadingInvites ? (
        <div className="rounded-3xl teacher-panel-soft p-5 text-sm teacher-muted flex items-center gap-3">
          <span className="boot-screen__bar" />
          Loading invite links…
        </div>
      ) : (
        <div className="space-y-4">
          {(['student', 'teacher'] as const).map((role) => {
            const activeLink = role === 'student' ? activeStudentLink : activeTeacherLink;
            const generating = generatingInvite === role;
            const copy = ROLE_COPY[role];
            return (
              <div key={role} className="rounded-3xl teacher-panel-soft p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold teacher-section-title">{copy.title}</h2>
                    <p className="text-sm teacher-muted">{copy.blurb}</p>
                  </div>
                  {activeLink && (
                    <span className="rounded-full teacher-pill px-3 py-1 text-xs whitespace-nowrap">
                      {activeLink.use_count} use{activeLink.use_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {activeLink ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="flex-1 min-w-0 truncate text-xs teacher-muted rounded-lg px-2 py-1.5 bg-black/5 dark:bg-white/5">
                      {getInviteUrl(activeLink.code, role)}
                    </code>
                    <button
                      type="button"
                      onClick={() => onCopy(activeLink.code, role)}
                      className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <ClipboardCopy className="h-3.5 w-3.5" />
                      {copiedCode === activeLink.code ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onGenerate(role)}
                      disabled={generating}
                      className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      {generating ? 'Generating…' : 'Regenerate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRevoke(activeLink.id)}
                      className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1 teacher-danger-text"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onGenerate(role)}
                    disabled={generating}
                    className="teacher-button-primary rounded-xl px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5"
                  >
                    <Link2 className="h-4 w-4" />
                    {generating ? 'Generating…' : `Generate ${role} invite link`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
