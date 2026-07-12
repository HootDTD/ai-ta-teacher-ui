---
doc: ai-ta-teacher-ui/_overview
description: Next.js 15 App Router teacher console — config, entry layout, env vars, Supabase auth helper, and BFF proxy pattern to the FastAPI backend on port 8000
owns:
  - "*.{ts,mjs,json}"
  - app/layout.tsx
  - app/globals.css
  - app/components/**
  - app/lib/**
  - public/**
related:
  - ai-ta-teacher-ui/pages
  - shared/product-context
  - ai-ta-backend/indexing
last_verified: 2026-07-12
stub: false
---

## Module map and file landmarks

| Path | Role |
|------|------|
| `package.json` | Name `teacher-ai-ta-ui` v0.1.0. Scripts: `dev` = `next dev --turbopack -p 3002`, `build`, `start`, `lint` (plain `eslint`). |
| `next.config.ts` | Empty `NextConfig` — no rewrites, no custom config at all. All backend proxying is done via `app/api/**` route handlers, not rewrites. |
| `tsconfig.json` | `strict: true`, `target: ES2017`, `moduleResolution: bundler`, path alias `@/*` → repo root (alias exists but pages use relative imports like `../../lib/auth`). |
| `eslint.config.mjs` | Flat config via `FlatCompat`, extends `next/core-web-vitals` + `next/typescript`; ignores `node_modules`, `.next`, `out`, `build`, `next-env.d.ts`. |
| `postcss.config.mjs` | Single plugin `@tailwindcss/postcss` (Tailwind v4 — no `tailwind.config.js`; theme lives in CSS). |
| `app/layout.tsx` | Root layout. Metadata: title "Hoot Teacher Console", description "Upload weekly notes and slides for AI-TA context." Renders `<body className="antialiased">{children}</body>`, imports `./globals.css`. No providers, no fonts loaded. |
| `app/globals.css` | `@import "tailwindcss"` + the entire design system as CSS custom properties on `:root` (light, warm beige palette `#e9dfcf`) and `html.dark` (dark overrides). Defines all `teacher-*` utility classes (see Non-obvious conventions). |
| `app/lib/auth.ts` | The only `app/lib/` module. Hand-rolled Supabase GoTrue client (no `@supabase/supabase-js` dependency) — see Public interfaces. |
| `app/components/*.tsx` | Client-side console sections and navigation, including `ConceptsPanel`, authored-set review, and generated-problem run review. They use raw `fetch`, local hook state, and semantic `teacher-*` CSS classes. |
| `public/*.svg` | Default create-next-app assets (file, globe, next, vercel, window); not referenced by app code. |
| `.env` | Local env file defining the four vars below. |
| `.github/workflows/ci.yml` | CI on push/PR to `main`/`staging`: Node 20, `npm ci` → `npm run lint` → `npm run build`; aggregation job `ci-passed` is the single required status (Railway "Wait for CI" gate). |
| `README.md` | **Stale** — copied from the student UI: mentions port 3001, chat UI, drag-drop, citation previews. Trust the code, not the README. |

Dependencies (runtime): `next ^15.5.9`, `react`/`react-dom` 19.1.0, `framer-motion ^12` (menu/week-card animations), `lucide-react ^0.543` (icons), `react-markdown ^10` (report rendering). Dev: TypeScript 5, ESLint 9, Tailwind 4. Notably absent: `@supabase/supabase-js`, any data-fetching lib (raw `fetch` everywhere), any state library (React hooks only), zod (no schema validation — responses are cast with `as`).

## Public interfaces

`app/lib/auth.ts` exports (all consumed by the three pages in `app/`):

- `type StoredSession = { access_token; refresh_token?; expires_at?; user_id?; user_email? }`
- `type SignUpResult = { session: StoredSession | null; requiresEmailConfirmation: boolean }`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — read from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (trailing slashes stripped from URL).
- `SUPABASE_AUTH_ENABLED` — boolean, true only if both vars set; pages render a config-error screen when false.
- `signInWithPassword(email, password): Promise<StoredSession>` — POST `{SUPABASE_URL}/auth/v1/token?grant_type=password` with `apikey` header.
- `signUpWithPassword(email, password): Promise<SignUpResult>` — POST `/auth/v1/signup`; `session === null` means email confirmation required.
- `refreshSession(refreshToken): Promise<StoredSession>` — POST `/auth/v1/token?grant_type=refresh_token`.
- `loadStoredSession() / saveStoredSession(s) / clearStoredSession()` — JSON in `localStorage` under key `hoot_auth_session_v1` (SSR-safe: no-ops when `window` undefined).
- `ensureActiveSession(session): Promise<StoredSession | null>` — returns session if it expires more than 30s from now, otherwise tries a refresh; returns null on failure (callers then clear storage and show sign-in form).

## Main data flows

1. **Auth bootstrap (every page)**: on mount, `ensureActiveSession(loadStoredSession())` → if valid, `saveStoredSession` + set state; else `clearStoredSession` and render inline email/password sign-in/sign-up form. There is no auth middleware, no cookies, no `@supabase/ssr` — auth is purely client-side localStorage.
2. **Backend calls**: client components `fetch('/api/...')` with `Authorization: Bearer <access_token>` → same-origin Next.js route handlers under `app/api/**` (all `runtime = 'nodejs'`) → forward verbatim (body + Authorization header) to `${AI_TA_API_BASE_URL}/<path>` (FastAPI backend, locally `http://localhost:8000`). The Supabase JWT is verified by the backend, not by this app. See `ai-ta-teacher-ui/pages` for the full proxy route inventory.
3. **Supabase usage**: only GoTrue auth REST endpoints (`/auth/v1/token`, `/auth/v1/signup`) are called directly from the browser. No direct Supabase DB/PostgREST/Storage access from this app — all data goes through the backend.

## Key dependencies

Environment variables (all four declared in `.env`):

| Var | Side | Use |
|-----|------|-----|
| `AI_TA_API_BASE_URL` | server-only | Backend base URL; read inside every `app/api/**` route handler; handlers return 500 `"AI_TA_API_BASE_URL missing"` if unset. Locally `http://localhost:8000`. |
| `NEXT_PUBLIC_SUPABASE_URL` | client | GoTrue auth base in `app/lib/auth.ts`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | `apikey` header for GoTrue calls. |
| `NEXT_PUBLIC_STUDENT_APP_URL` | client | Base URL used in `app/page.tsx` to build **student** invite URLs (`{studentApp}/join/{code}`); falls back to `window.location.origin`. Teacher invite URLs always use this app's own origin. |

Exact backend (port 8000) endpoint inventory is maintained in `ai-ta-teacher-ui/pages`; it includes the `/apollo/problem-generation/**` seed, variant-run, run-detail, and approval endpoints used by the generated-problem review surface.

## Non-obvious conventions

- **Port 3002** for dev (`-p 3002`); student UI is 3001, backend 8000. The README says 3001 — it's wrong/stale for this repo.
- **BFF proxy pattern, no rewrites**: every backend call has a thin pass-through route handler in `app/api/**`. Handlers strip nothing and add nothing except forwarding the `Authorization` header; most read `resp.text()` and re-wrap with `Cache-Control: no-store`. New backend endpoints need a new proxy file.
- **Theming**: dark mode = `html.dark` class toggled client-side, persisted in `localStorage` key `theme`, with a transient `theme-transition` class for animated switches (handled inside `app/page.tsx`, not the layout). All colors are CSS vars; components use semantic classes `teacher-shell`, `teacher-panel[-soft|-subtle]`, `teacher-input`, `teacher-button-primary|secondary`, `teacher-alert--danger|success|warning`, `teacher-pill--*`, `teacher-prose`, `header-menu*` defined in `globals.css`, mixed with Tailwind utilities for layout.
- **Console section components** live under `app/components/`; they remain dependency-light and use local hooks/raw fetch rather than a component, data-fetching, or state library.
- **Error handling convention**: route handlers pass backend status/body through untouched; pages parse error bodies as `{ detail }` (FastAPI style) with text fallback.
- **No tests** in this repo; CI is lint + build only.

## Product context

Hoot is a RAG-based AI teaching assistant. This app is the teacher-facing console ("Hoot | Teacher Console"): teachers create classes, upload weekly course PDFs (notes + slides) that the backend OCRs and indexes for student Q&A, control which week students can see, tune retrieval resource weights (slides vs notes bias), generate invite links, and view per-chat AI-use reports. The student-facing app is a sibling repo (`ai-ta-student-ui`, port 3001); the FastAPI backend (`ai-ta-backend`, port 8000) owns all data and authorization.
