---
doc: api/authored-sets
description: BFF proxies for authored problem sets (all forward to backend /apollo/authored-sets*), including the PATCH problem-edit endpoint shared by two authoring panels.
owns:
  - app/api/teacher/authored-sets/route.ts
  - app/api/teacher/authored-sets/[set_id]/route.ts
  - app/api/teacher/authored-sets/manual/route.ts
  - app/api/teacher/authored-sets/[set_id]/problems/[problem_id]/approve/route.ts
  - app/api/teacher/problems/[problem_id]/route.ts
related: [api/_index, authoring/problem-sets, authoring/generated-problems]
last_verified: 2026-07-25
stub: false
---

# api/authored-sets

Authored problem-set proxies to the backend `/apollo/authored-sets*` surface.
Uniform contract: [api/_index](_index.md).

## Interface (file → method → backend)

| File | Methods | Backend |
|---|---|---|
| `authored-sets/route.ts` | GET (`?search_space_id=`), POST | `/apollo/authored-sets` |
| `authored-sets/[set_id]/route.ts` | GET (`?full_text=`), DELETE | `/apollo/authored-sets/{set_id}` |
| `authored-sets/manual/route.ts` | POST | `/apollo/authored-sets/manual` |
| `authored-sets/[set_id]/problems/[problem_id]/approve/route.ts` | POST | `/apollo/authored-sets/{set_id}/problems/{problem_id}/approve` |
| `teacher/problems/[problem_id]/route.ts` | PATCH | `/apollo/authored-sets/problems/{problem_id}` |

## Invariants & gotchas

- **`authored-sets` POST re-sends `req.formData()`** (paired PDFs, multipart);
  `manual` POST is JSON.
- **`teacher/problems/[problem_id]` (PATCH) is a shared endpoint** — called by
  BOTH [authoring/problem-sets](../authoring/problem-sets.md) and
  [authoring/generated-problems](../authoring/generated-problems.md) for the
  pencil reference-step edit flow. Record this cross-panel dependency when
  touching it.

## Related

- Callers: [authoring/problem-sets](../authoring/problem-sets.md),
  [authoring/generated-problems](../authoring/generated-problems.md).
