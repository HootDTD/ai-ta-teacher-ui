---
doc: shell/_index
description: Router for the shell domain — app-level scaffolding, the page.tsx orchestrator, sidebar nav, styling, build config, and the auth + shared-type libs.
owns: []
related: [shell/navigation, shell/console-orchestrator, sections/_index]
last_verified: 2026-07-25
stub: false
---

# shell — app scaffolding & orchestrator

`page.tsx` is the console's single state store, data-fetching hub, and section
router; every other leaf here is one of its dependencies.

| Leaf | One-liner | Owns |
|---|---|---|
| [console-orchestrator](console-orchestrator.md) | `TeacherConsole` — state store + fetch hub + section switch | `app/page.tsx` |
| [app-entry](app-entry.md) | root layout (Fraunces font), empty next config, favicon | `app/layout.tsx`, `next.config.ts`, `app/favicon.ico` |
| [styling](styling.md) | the whole design system as CSS (`teacher-*` classes, themes) | `app/globals.css` + brand assets |
| [navigation](navigation.md) | `TeacherSidebar` + the exported `SectionKey` union type | `app/components/TeacherSidebar.tsx` |
| [project-config](project-config.md) | package/tsconfig/eslint/postcss build glue | `package.json`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs` |
| [auth-client](auth-client.md) | hand-rolled Supabase GoTrue REST client + proactive refresh | `app/lib/auth.ts` |
| [console-types](console-types.md) | shared client types/consts + the `APOLLO_ONLY` flag | `app/lib/teacher.ts`, `app/lib/flags.ts` |

## Cross-cutting invariants

- **Dumb sections vs self-fetching panels.** The four `sections/` components are
  presentational — they receive all state + callbacks from `page.tsx` as props.
  The three `authoring/` panels fetch their own data from only `searchSpaceId` +
  `accessToken`. Preserve this seam when moving code.
- **`lib/` breaks a cycle.** `teacher.ts`/`flags.ts` live in `lib/` so both
  `page.tsx` and the section components import shared types/consts without a
  page↔component import cycle.
- **`SectionKey` is a cross-file contract.** Exported by `navigation.md`, imported
  by `console-orchestrator.md` to type `activeSection`. Changing the set of
  sections touches both files (recipe below).
- **Proactive session refresh.** `auth-client.md`'s `ensureFreshStoredSession`
  (single-flight) is driven by `page.tsx` on a 240s tick + tab-visible, keeping a
  long-open console tab from 401ing mid-class.

## Recipe — add a console section (D21)

1. `navigation.md` (`app/components/TeacherSidebar.tsx`): add the key to the
   `SectionKey` union.
2. `console-orchestrator.md` (`app/page.tsx`): add a row to `ALL_SECTIONS`
   (key/label/icon); add an `activeSection === '<key>'` render branch; if the
   section is Hoot-only, add the key to `HOOT_ONLY_SECTIONS`.
3. Add the component — a dumb one under [sections/](../sections/_index.md) or a
   self-fetching one under [authoring/](../authoring/_index.md).
4. If it needs backend data, add a proxy under [api/](../api/_index.md).

Back-links: [sections/_index](../sections/_index.md) ·
[navigation](navigation.md) · [console-orchestrator](console-orchestrator.md).
