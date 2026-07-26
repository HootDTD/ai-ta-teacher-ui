---
doc: shell/navigation
description: TeacherSidebar — the presentational left-rail navigation, plus the exported SectionKey union type that page.tsx imports to drive activeSection.
owns:
  - app/components/TeacherSidebar.tsx
related: [shell/console-orchestrator, shell/styling, sections/_index]
last_verified: 2026-07-25
stub: false
---

# navigation — TeacherSidebar

## Interface

- `default export TeacherSidebar` (~69 lines, stateless).
- **`export type SectionKey`** — the union
  `'materials' | 'concepts' | 'problem-sets' | 'generated-problems' |
  'ai-tuning' | 'invites' | 'reports'`. This is a **cross-file contract**:
  `console-orchestrator` (`app/page.tsx`) imports it to type `activeSection` and
  its `ALL_SECTIONS` list.
- Props: `sections: { key: SectionKey; label; icon: LucideIcon }[]`, `active`,
  `onSelect(key)`, `open`, `onClose`.

## Data flow

Renders the brand lockup (`thinking.mp4` owl + "Hoot / Teacher") and one nav
button per `sections` entry, marking the active one with `aria-current="page"`.
Mobile: the `open` prop adds `teacher-sidebar--open`; a full-screen backdrop
button fires `onClose`. No local state, no fetching — the parent owns
`activeSection` and open/close.

## Invariants & gotchas

- **Adding or removing a section starts here** — edit the `SectionKey` union,
  then `console-orchestrator`'s `ALL_SECTIONS` / `HOOT_ONLY_SECTIONS` and add the
  component + any proxy. See the "add a section" recipe in
  [shell/_index](_index.md).
- Styling comes from the `teacher-sidebar*` / `teacher-sidebar-item*` families in
  [styling](styling.md); the brand video is a shared asset owned there.

## Related

- Consumer + recipe: [console-orchestrator](console-orchestrator.md),
  [sections/_index](../sections/_index.md).
