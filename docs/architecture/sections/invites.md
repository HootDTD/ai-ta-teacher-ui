---
doc: sections/invites
description: InvitesSection — presentational student/teacher join-link cards (one active link per role) with copy, regenerate, and revoke controls.
owns:
  - app/components/InvitesSection.tsx
related: [shell/console-orchestrator, shell/console-types, api/auth-classes-invites]
last_verified: 2026-07-25
stub: false
---

# invites — InvitesSection

Presentational (~122 lines, default export).

## Interface

Props: `loadingInvites`, `activeStudentLink`, `activeTeacherLink`
(`InviteLink | null`), `generatingInvite`, `copiedCode`,
`getInviteUrl(code, role)`, `onGenerate(role)`, `onCopy(code, role)`,
`onRevoke(linkId)`. Local const `ROLE_COPY` (student/teacher titles + blurbs).

## Data flow

One card per role. When a link exists: shows a `use_count` pill, the built join
URL, and Copy / Regenerate / Revoke controls; otherwise a Generate button. The
URL is built by the parent's `getInviteUrl` — student links use
`NEXT_PUBLIC_STUDENT_APP_URL` (the sibling student app, port 3001), teacher links
use this app's own origin. All fetching lives in `console-orchestrator`.

## Invariants & gotchas

- **One active link per role** — regenerating replaces the active link; the
  parent enforces this by picking `role === … && is_active`.

## Related

- State owner + `getInviteUrl`: [console-orchestrator](../shell/console-orchestrator.md).
- Proxies: [api/auth-classes-invites](../api/auth-classes-invites.md).
