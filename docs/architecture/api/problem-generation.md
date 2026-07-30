---
doc: api/problem-generation
description: BFF proxies for Apollo variant problem-generation — seed listing, run start, run listing/detail, and generated-reference approval.
owns:
  - app/api/teacher/problem-generation/concepts/[concept_id]/seeds/route.ts
  - app/api/teacher/problem-generation/concepts/[concept_id]/variants/route.ts
  - app/api/teacher/problem-generation/problems/[problem_id]/approve/route.ts
  - app/api/teacher/problem-generation/runs/route.ts
  - app/api/teacher/problem-generation/runs/[run_id]/route.ts
related: [api/_index, authoring/concepts, authoring/generated-problems]
last_verified: 2026-07-25
stub: false
---

# api/problem-generation

Apollo variant-generation proxies to `/apollo/problem-generation/*`. Uniform
contract: [api/_index](_index.md).

## Interface (file → method → backend)

| File | Methods | Backend |
|---|---|---|
| `concepts/[concept_id]/seeds/route.ts` | GET | `/apollo/problem-generation/concepts/{concept_id}/seeds` |
| `concepts/[concept_id]/variants/route.ts` | POST | `/apollo/problem-generation/concepts/{concept_id}/variants` |
| `problems/[problem_id]/approve/route.ts` | POST | `/apollo/problem-generation/problems/{problem_id}/approve` |
| `runs/route.ts` | GET (`?search_space_id=`) | `/apollo/problem-generation/runs` |
| `runs/[run_id]/route.ts` | GET (`?full_text=`) | `/apollo/problem-generation/runs/{run_id}` |

## Invariants & gotchas

- The panels treat `404` from these endpoints as a quiet "unavailable" state and
  `403` as "disabled" — the proxies just pass the status through.

## Related

- Callers: [authoring/concepts](../authoring/concepts.md) (seeds + variants
  launcher), [authoring/generated-problems](../authoring/generated-problems.md)
  (runs + approve).
