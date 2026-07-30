# AI-TA Teacher UI

Next.js 15 App Router app — the teacher console of Hoot (course material
uploads, invite management, analytics, and AI-use reports). Talks to the
FastAPI backend (port 8000 in dev) through `app/api/**` proxy routes; auth via
Supabase.

> This repo is part of the Hoot AI-TA workspace. If a workspace-level
> `CLAUDE.md` wasn't loaded (session opened inside this repo), read
> `../ai-ta-backend/docs/shared-architecture/README.md` for the full cross-repo
> doc map, conventions, security, and product context.

## Doc tree — navigate docs first, code second

`docs/architecture/` describes this repo's code; each doc declares `owns:`
globs in its frontmatter and is the authority on those files:

- `docs/architecture/_overview.md` — config, entry layout, env vars, Supabase auth helper, BFF proxy pattern
- Domain trees, each routed by its `_index.md`: `shell/` (console orchestrator,
  navigation, auth client), `sections/` (Materials, Performance, AI Tuning,
  Invites, Reports), `authoring/` (self-fetching Apollo panels), `api/` (BFF
  proxy leaves), `routes/` (join flow, report viewer). Resolve any source file
  to its owning leaf via `docs/index.json`.

Never read a source file to understand the *system* — that's what the docs are
for. Read code only to make the change.

**Drift contract:** before editing a source file, load its owner doc. After
editing code, update the owner doc in the same commit and bump
`last_verified`. Stale docs are worse than no docs.

## Dev

```bash
npm run dev   # port 3002
```

Backend must be running on :8000 (see `../ai-ta-backend/CLAUDE.md`).
