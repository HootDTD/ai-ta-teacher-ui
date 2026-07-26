---
doc: ai-ta-teacher-ui/_overview
description: Thin root router for the Next.js 15 teacher console — routes to the five domain indexes (shell, sections, authoring, routes, api).
owns: []
related: []
last_verified: 2026-07-25
stub: false
---

# Teacher UI — architecture router

Next.js 15 App Router teacher console. Dev port **3002**. All backend access is a
**BFF-proxy pattern**: `app/api/**/route.ts` handlers forward to the FastAPI
backend at `AI_TA_API_BASE_URL` (port 8000) — there are **no** `next.config`
rewrites. Auth is **client-only** Supabase GoTrue (hand-rolled, no
`@supabase/supabase-js`, no SSR/cookies); the JWT is verified backend-side, not
here. No test runner and no unit CI yet — CI is lint + build only.

One of three sibling git repos (`ai-ta-backend`, `ai-ta-student-ui`,
`ai-ta-teacher-ui`). For cross-repo context see the shared docs
(`shared-architecture/product-context`, `conventions`, `security`).

Reading protocol: land here from `shared-architecture/README`, pick a domain
`_index.md`, then read 1-3 leaf docs.

## Domains

| Domain | Index | Covers |
|---|---|---|
| shell | [shell/_index.md](shell/_index.md) | app entry, the `page.tsx` orchestrator, sidebar nav, styling, build config, auth + shared-type libs |
| sections | [sections/_index.md](sections/_index.md) | dumb, orchestrator-fed console sections (Materials / AI Tuning / Invites / Reports) |
| authoring | [authoring/_index.md](authoring/_index.md) | self-fetching Apollo problem-authoring panels (Concepts / Problem Sets / Generated Problems) |
| routes | [routes/_index.md](routes/_index.md) | standalone full-page routes (join, report) rendered outside the console shell |
| api | [api/_index.md](api/_index.md) | the 27 `app/api/**` BFF proxy routes, grouped by backend resource |

Two seams the whole app turns on: **`page.tsx` is the single state store + fetch
hub** feeding the dumb `sections/`, while `authoring/` panels fetch their own
data from only `searchSpaceId` + `accessToken`. See `shell/_index.md` for the
cross-cutting invariants and the "add a section" recipe.
