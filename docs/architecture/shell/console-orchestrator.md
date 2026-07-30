---
doc: shell/console-orchestrator
description: TeacherConsole (app/page.tsx) — the console's single state store, data-fetching hub, and section router that feeds the four presentational sections by props.
owns:
  - app/page.tsx
related: [shell/navigation, shell/auth-client, shell/console-types, sections/_index, sections/materials, sections/ai-tuning, sections/invites, sections/reports, sections/performance, authoring/_index, api/auth-classes-invites, api/materials]
last_verified: 2026-07-30
stub: false
---

# console-orchestrator — app/page.tsx

`TeacherConsole`, the default export (no props, ~1112 lines). It is the whole
console's state store, fetch hub, and section switch. The four `sections/`
components are dumb and receive everything from here; the three `authoring/`
panels are self-fetching and get only `searchSpaceId` + `accessToken`.

## Interface

Default-exported React client component (`"use client"`), mounted at route `/`.
No props. Imports `SectionKey` from `navigation`, auth helpers from
`auth-client`, and all shared types/consts + `APOLLO_ONLY` from `console-types`.

`SECTIONS = ALL_SECTIONS.filter(...)` — the sidebar list, with `HOOT_ONLY_SECTIONS`
(`['ai-tuning','reports']`) removed when `APOLLO_ONLY` is set.

## Data flow

~30 `useState` slots, grouped: auth (`session`, `authReady`, `authError`,
`email`/`password`), classes (`classOptions`, `selectedClassId`, create-class
UI), course materials (`courseState`, `loading`, `pendingWeek`, upload busy
flags), weights (`weights`/`serverWeights`/`defaultWeights`/`weightBounds`),
invites (`inviteLinks`, `copiedCode`), and UI (`darkMode`, `headerMenuOpen`,
`activeSection`, `sidebarOpen`).

Fetchers + handlers it owns for the presentational sections:
- **Materials** — `fetchWeeks` (`GET /api/teacher/weeks`; a `hasPendingUploads`
  memo drives a `POLL_INTERVAL_MS` background re-poll), `handleCurrentWeekSave`,
  `handleUpload`, `handleUploadTextbook`, `handleRetryUpload`.
- **AI Tuning** — `fetchWeights`, `handleWeightChange`, `handleSaveWeights`,
  `handleResetWeights`, plus `weightsDirty` / `canResetToDefaults` memos.
- **Invites** — `fetchInviteLinks`, `handleGenerateInvite`, `handleRevokeInvite`,
  `handleCopyInvite`, and `getInviteUrl` (student links use
  `NEXT_PUBLIC_STUDENT_APP_URL`, teacher links use this origin).
- **Classes** — `fetchClassOptions` (`GET /api/my-classes`), `handleCreateClass`.

Auth effects: on mount `ensureActiveSession(loadStoredSession())` gates the whole
app; a second effect runs proactive refresh — `ensureFreshStoredSession()` on a
`setInterval(..., 240_000)` **and** on `visibilitychange` (wake-from-sleep),
adopting a rotated `access_token` back into `session` state.

Render tree (in order): `!authReady` → boot screen (`thinking.mp4` owl);
`!SUPABASE_AUTH_ENABLED` → config-error card; `!session` → sign-in / sign-up
form; else the shell — `TeacherSidebar` + a topbar (class select/create, week
pill, account menu with theme toggle + sign-out) + `<main>` switching on
`activeSection` to `MaterialsSection` / `ConceptsPanel` / `AuthoredSetsPanel` /
`GeneratedProblemsPanel` / `AiTuningSection` / `InvitesSection` / `ReportsSection`.

## Invariants & gotchas

- **Dumb-section vs self-fetching-panel seam.** All Materials/AiTuning/Invites/
  Reports state lives here; the three authoring panels own their own fetch/poll/
  edit state — do not lift it back in.
- **`activeSection` is typed by the imported `SectionKey`**; adding a section
  means editing both this file and `navigation` (see the shell "add a section"
  recipe).
- **Theme** is an `html.dark` class persisted under `localStorage['theme']`, with
  a transient `theme-transition` class on toggle — handled here, not in the layout.
- **Textbook upload** reuses `handleUpload`'s endpoint with the `kind='textbook'`,
  `week='0'` course-wide sentinel (backend ignores the week).

## Env flags

- `APOLLO_ONLY` (via `console-types`) — hides the Hoot-only sections.
- `NEXT_PUBLIC_STUDENT_APP_URL` — base for student invite URLs in `getInviteUrl`.

## Related

- Section props contracts: [sections/_index](../sections/_index.md).
- Auth helpers: [auth-client](auth-client.md). Shared types: [console-types](console-types.md).
- Sidebar + `SectionKey`: [navigation](navigation.md).
