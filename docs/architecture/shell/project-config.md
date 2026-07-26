---
doc: shell/project-config
description: Build, lint, type, and Tailwind config glue — package.json, tsconfig.json, eslint.config.mjs, postcss.config.mjs — for a raw-fetch, hand-rolled-auth app.
owns:
  - package.json
  - tsconfig.json
  - eslint.config.mjs
  - postcss.config.mjs
related: [shell/auth-client, shell/styling]
last_verified: 2026-07-25
stub: false
---

# project-config — build/lint/type glue

## Interface

- **package.json** — name `teacher-ai-ta-ui`. Scripts: `dev` =
  `next dev --turbopack -p 3002`, plus `build` / `start` / `lint`. Runtime deps:
  `next ^15.5`, `react`/`react-dom` 19.1, `framer-motion ^12`,
  `lucide-react ^0.543`, `react-markdown ^10`.
- **tsconfig.json** — `strict`, `target ES2017`, `moduleResolution: bundler`,
  `@/*` alias → repo root (pages actually use relative imports).
- **eslint.config.mjs** — flat config via `FlatCompat`, extends
  `next/core-web-vitals` + `next/typescript`.
- **postcss.config.mjs** — single `@tailwindcss/postcss` plugin (Tailwind v4;
  there is no `tailwind.config.js` — the theme lives in CSS, see
  [styling](styling.md)).

## Invariants & gotchas

- **Notably absent** deps: `@supabase/supabase-js` (auth is hand-rolled GoTrue,
  see [auth-client](auth-client.md)); any data-fetching lib (raw `fetch`
  everywhere); any state lib (React hooks only); `zod` (responses are cast with
  `as`, not validated). Keep new work dependency-light.
- **No test runner is wired** — CI (`.github/workflows/ci.yml`, not owned by any
  leaf) is Node 20 `npm ci → lint → build`, aggregated by a `ci-passed` gate. The
  95% patch-coverage contract has no runner here yet; list untested UI changes
  explicitly in the PR. The workflow still special-cases the retired `ApolloV3`
  branch — treat that as stale-in-workflow, not current truth.

## Related

- Theme/CSS: [styling](styling.md). Auth client: [auth-client](auth-client.md).
