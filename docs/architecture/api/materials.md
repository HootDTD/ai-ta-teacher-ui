---
doc: api/materials
description: BFF proxies for course materials and retrieval weights — weeks, current-week, multipart upload, upload retry, and retrieval-weights get/post.
owns:
  - app/api/teacher/weeks/route.ts
  - app/api/teacher/current-week/route.ts
  - app/api/teacher/upload/route.ts
  - app/api/teacher/uploads/[id]/retry/route.ts
  - app/api/teacher/retrieval-weights/route.ts
related: [api/_index, sections/materials, sections/ai-tuning]
last_verified: 2026-07-25
stub: false
---

# api/materials

Course-materials + retrieval-weights proxies feeding
[sections/materials](../sections/materials.md) and
[sections/ai-tuning](../sections/ai-tuning.md). Uniform contract:
[api/_index](_index.md).

## Interface (file → method → backend)

| File | Methods | Backend |
|---|---|---|
| `teacher/weeks/route.ts` | GET (`?search_space_id=`) | `/teacher/weeks` |
| `teacher/current-week/route.ts` | POST | `/teacher/weeks/current` |
| `teacher/upload/route.ts` | POST | `/teacher/upload` |
| `teacher/uploads/[id]/retry/route.ts` | POST | `/teacher/uploads/{id}/retry` |
| `teacher/retrieval-weights/route.ts` | GET, POST | `/teacher/retrieval-weights` |

## Invariants & gotchas

- **`upload` re-sends `req.formData()`** (multipart) rather than raw text — used
  for weekly notes/slides **and** the course textbook (via the `kind='textbook'`,
  `week='0'` course-wide sentinel set by the caller).
- `retrieval-weights` POST echoes the full backend weight set; only
  textbook/slides/notes are editable in the UI.
- Uploads feed the backend OCR/indexing pipeline (cross-repo).

## Related

- Callers: [sections/materials](../sections/materials.md),
  [sections/ai-tuning](../sections/ai-tuning.md).
