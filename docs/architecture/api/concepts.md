---
doc: api/concepts
description: BFF proxies for WU-TCA concept authoring — list/create and patch/delete against the backend /apollo/teacher/concepts* surface.
owns:
  - app/api/teacher/concepts/route.ts
  - app/api/teacher/concepts/[concept_id]/route.ts
related: [api/_index, authoring/concepts]
last_verified: 2026-07-25
stub: false
---

# api/concepts

Concept-authoring proxies to `/apollo/teacher/concepts*`. Uniform contract:
[api/_index](_index.md).

## Interface (file → method → backend)

| File | Methods | Backend |
|---|---|---|
| `teacher/concepts/route.ts` | GET (`?search_space_id=`), POST | `/apollo/teacher/concepts` |
| `teacher/concepts/[concept_id]/route.ts` | PATCH, DELETE | `/apollo/teacher/concepts/{concept_id}` |

## Related

- Caller: [authoring/concepts](../authoring/concepts.md) (ConceptsPanel).
