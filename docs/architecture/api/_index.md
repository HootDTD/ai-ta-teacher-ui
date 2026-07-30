---
doc: api/_index
description: Router for the app/api/** BFF proxy domain — the uniform pass-through contract shared by all 27 route handlers, grouped into 6 resource leaves.
owns: []
related: []
last_verified: 2026-07-30
stub: false
---

# api — BFF proxy routes

All 27 `app/api/**/route.ts` handlers are thin, identical BFF proxies to the
FastAPI backend. Because each is a ~20-40 line zero-logic pass-through, they are
grouped by backend resource rather than documented one-per-file.

## The uniform proxy contract

Every handler: `export const runtime = 'nodejs'`; reads
`process.env.AI_TA_API_BASE_URL` (trailing slash stripped) and returns 500
`"AI_TA_API_BASE_URL missing"` if unset; forwards the incoming `Authorization`
header and the request body verbatim to `{base}/<path>`; returns the backend
response body with `Cache-Control: no-store` and the passed-through
`Content-Type`. Dynamic routes take Next 15 `Promise` `ctx.params`. **The JWT is
verified backend-side, not here.**

| Leaf | Backend family | Owns |
|---|---|---|
| [auth-classes-invites](auth-classes-invites.md) | `/classes`, `/my-classes`, `/invite-links*` | 6 route.ts |
| [materials](materials.md) | `/teacher/weeks`, `/teacher/upload`, `/teacher/retrieval-weights` | 5 route.ts |
| [authored-sets](authored-sets.md) | `/apollo/authored-sets*` (+ shared PATCH) | 5 route.ts |
| [concepts](concepts.md) | `/apollo/teacher/concepts*` | 2 route.ts |
| [problem-generation](problem-generation.md) | `/apollo/problem-generation/*` | 5 route.ts |
| [reports-chat](reports-chat.md) | `/reports/ai-use/*`, `/ask`, `/chats/*` | 4 route.ts |
| [classroom](classroom.md) | `/apollo/teacher/classroom/{id}/performance` | 1 route.ts |

## Cross-cutting invariants

- The proxy tables in the leaves **are** the cross-repo contract with the backend.
- `/api/invite-links/resolve/[code]` is the **only unauthenticated** proxy;
  resolve + redeem also return `502` on a backend fetch failure.
- Streaming (`/ask`) and binary (`.pdf`) responses forward `resp.body` directly;
  most others re-emit `resp.text()`.
