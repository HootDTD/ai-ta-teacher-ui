---
doc: api/classroom
description: BFF proxy for the teacher classroom-performance endpoint — forwards to the backend's /apollo/teacher/classroom/{id}/performance.
owns:
  - app/api/teacher/classroom/[search_space_id]/performance/route.ts
related: [api/_index, sections/performance]
last_verified: 2026-07-30
stub: false
---

# classroom — performance proxy

## Interface

One GET pass-through in the standard proxy shape (`runtime='nodejs'`, reads
`AI_TA_API_BASE_URL`, forwards the `Authorization` header, returns the
backend body with `Cache-Control: no-store`, 500 `"AI_TA_API_BASE_URL
missing"` if unset; Next 15 `Promise` ctx params):

| Proxy route (methods) | Backend endpoint |
|----------------------|------------------|
| `app/api/teacher/classroom/[search_space_id]/performance/route.ts` (GET) | `GET /apollo/teacher/classroom/{search_space_id}/performance` — teacher-gated server-side |

Auth is enforced by the backend (`require_course_teacher`); the proxy adds
nothing. Consumed only by `sections/performance`.

The route itself is a byte-for-byte pass-through — it never changes shape
with the backend payload. The v2 `PerformancePayload` contract (emails
instead of ids, `problems` + `insights` blocks, no `xp`/`level`/
`misconception_corrected`) is documented and typed only in
[sections/performance](../sections/performance.md); this leaf does not
mirror the schema.
