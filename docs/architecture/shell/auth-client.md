---
doc: shell/auth-client
description: Hand-rolled browser-side Supabase GoTrue REST client — the only auth in the repo — including the new single-flight proactive refresh (ensureFreshStoredSession).
owns:
  - app/lib/auth.ts
related: [shell/console-orchestrator, routes/join, routes/report]
last_verified: 2026-07-25
stub: false
---

# auth-client — app/lib/auth.ts

The only auth in the repo: a hand-rolled Supabase GoTrue REST client (~197
lines), browser-side, **no** `@supabase/supabase-js`, no cookies/SSR.

## Interface

- Types: `StoredSession` (`access_token`, `refresh_token?`, `expires_at?`,
  `user_id?`, `user_email?`), `SignUpResult`.
- Consts: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (from `NEXT_PUBLIC_*`),
  `SUPABASE_AUTH_ENABLED` (both set).
- `signInWithPassword`, `signUpWithPassword` (a `null` session ⇒ email
  confirmation required), `refreshSession`.
- `loadStoredSession` / `saveStoredSession` / `clearStoredSession` — JSON in
  `localStorage['hoot_auth_session_v1']`, SSR-safe (no-op without `window`).
- `ensureActiveSession(session)` — page-load gate: returns the session unless it
  expires within 30s, else refreshes; `null` on failure.
- `ensureFreshStoredSession()` — **proactive** refresh: refreshes the *stored*
  session when `< REFRESH_BUFFER_SEC` (420s) validity remains, **single-flighted**
  via a module-level `refreshInFlight` promise.

## Data flow

GoTrue REST directly from the browser: POST `{SUPABASE_URL}/auth/v1/token`
(`grant_type=password` / `refresh_token`) and `/auth/v1/signup`, with the
`apikey` header. Consumed by `console-orchestrator` (`page.tsx`), and the
standalone [routes/join](../routes/join.md) and [routes/report](../routes/report.md)
pages. `page.tsx` calls `ensureFreshStoredSession` on a 240s tick +
`visibilitychange`.

## Invariants & gotchas

- **Single-flight is mandatory:** Supabase rotates refresh tokens, so two
  concurrent refreshes would invalidate each other; the guard serializes them.
- **On refresh failure `ensureFreshStoredSession` returns the *stale* session
  unchanged** — a transient network blip must not sign a teacher out mid-class;
  the eventual 401 surfaces instead.
- JWT is verified **backend-side** (in the BFF proxies' target), never here.

## Env flags

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — when either is
  missing, `SUPABASE_AUTH_ENABLED` is false and callers render a config-error
  screen. Never name the Supabase project; it is per-deploy.

## Related

- Caller + refresh driver: [console-orchestrator](console-orchestrator.md).
