"use client";

import type { LucideIcon } from 'lucide-react';

export type SectionKey =
  | 'materials'
  | 'concepts'
  | 'problem-sets'
  | 'generated-problems'
  | 'ai-tuning'
  | 'invites'
  | 'reports';

type SectionDef = { key: SectionKey; label: string; icon: LucideIcon };

type Props = {
  sections: SectionDef[];
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  open: boolean;
  onClose: () => void;
};

export default function TeacherSidebar({ sections, active, onSelect, open, onClose }: Props) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="teacher-sidebar-backdrop lg:hidden"
        />
      )}
      <aside className={`teacher-sidebar ${open ? 'teacher-sidebar--open' : ''}`}>
        <div className="teacher-sidebar__brand">
          <video
            src="/thinking.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="teacher-sidebar__owl"
            aria-hidden
          />
          <div className="teacher-sidebar__lockup">
            <span className="teacher-brand">Hoot</span>
            <span className="teacher-sidebar__subtitle">Teacher</span>
          </div>
        </div>
        <nav className="teacher-sidebar__nav">
          {sections.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-current={active === key ? 'page' : undefined}
              className={`teacher-sidebar-item ${active === key ? 'teacher-sidebar-item--active' : ''}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
