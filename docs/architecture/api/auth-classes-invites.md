---
doc: api/auth-classes-invites
description: BFF proxies for classes and invite links — including the only unauthenticated proxy (invite resolve) and the invite redeem endpoint.
owns:
  - app/api/classes/route.ts
  - app/api/my-classes/route.ts
  - app/api/invite-links/route.ts
  - app/api/invite-links/[id]/route.ts
  - app/api/invite-links/resolve/[code]/route.ts
  - app/api/invite-links/redeem/[code]/route.ts
related: [api/_index, shell/console-orchestrator, sections/invites, routes/join]
last_verified: 2026-07-25
stub: false
---

# api/auth-classes-invites

Class + invite-link proxies. All follow the uniform contract in
[api/_index](_index.md).

## Interface (file → method → backend)

| File | Methods | Backend |
|---|---|---|
| `classes/route.ts` | GET, POST | `/classes` |
| `my-classes/route.ts` | GET | `/my-classes` |
| `invite-links/route.ts` | GET (`?search_space_id=`), POST | `/invite-links` |
| `invite-links/[id]/route.ts` | DELETE | `/invite-links/{id}` (204, bodyless) |
| `invite-links/resolve/[code]/route.ts` | GET | `/invite-links/resolve/{code}` |
| `invite-links/redeem/[code]/route.ts` | POST | `/invite-links/redeem/{code}` |

## Invariants & gotchas

- **`resolve/[code]` is the only unauthenticated proxy** — it forwards no
  `Authorization` header. Both `resolve` and `redeem` return `502` on a backend
  fetch failure (they wrap the fetch in try/catch, unlike the others).
- `invite-links/[id]` DELETE passes the `204` through with no body.

## Related

- Callers: [console-orchestrator](../shell/console-orchestrator.md) +
  [sections/invites](../sections/invites.md) (classes/my-classes/invite-links);
  [routes/join](../routes/join.md) (resolve + redeem).
