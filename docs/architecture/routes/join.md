---
doc: routes/join
description: JoinPage (/join/[code]) — resolves an invite code (unauthenticated), then after sign-in auto-redeems it and redirects into the console.
owns:
  - app/join/[code]/page.tsx
related: [shell/auth-client, api/auth-classes-invites, shell/styling]
last_verified: 2026-07-25
stub: false
---

# join — /join/[code]

Standalone page (~303 lines, default export `JoinPage`), reads `code` via
`useParams`.

## Interface

Types `ResolvedLink` (`search_space_id`, `course_name`, `role`) and
`RedeemResult`. Uses `lib/auth` sign-in/sign-up for the unauthenticated path.

## Data flow

1. On mount: `ensureActiveSession(loadStoredSession())` and, in parallel,
   `GET /api/invite-links/resolve/{code}` (unauthenticated) to show the course
   name — or an "Invalid invite link" card.
2. Once a session exists **and** the link resolved, a `useEffect` auto-`POST`s
   `/api/invite-links/redeem/{code}` with the `Bearer` token.
3. On `success`, shows "You're in!" then `router.push('/')` after 1.5s.

## Invariants & gotchas

- Role-aware brand subtitle: student invites show "AI Teaching Assistant",
  otherwise "Teacher Console".
- Uses the shared `auth-screen` / `auth-card` / `auth-brand` / `boot-screen` +
  `teacher-*` design system (not the old raw gray/red Tailwind).
- Redeem is guarded by `redeemSuccess` so it fires once.

## Related

- Auth: [shell/auth-client](../shell/auth-client.md). Proxies (resolve/redeem):
  [api/auth-classes-invites](../api/auth-classes-invites.md).
