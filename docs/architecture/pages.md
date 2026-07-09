---
doc: ai-ta-teacher-ui/pages
description: Route inventory — teacher console (app/page.tsx), invite join flow, AI-use report viewer, and the app/api/** proxy routes to the FastAPI backend
owns:
  - app/page.tsx
  - app/join/**
  - app/report/**
  - app/api/**
related:
  - ai-ta-teacher-ui/_overview
  - shared/product-context
  - ai-ta-backend/indexing
last_verified: 2026-06-12
stub: false
---

## Module map and file landmarks

Three UI routes (all `"use client"` single-file pages, no shared components) plus 14 API proxy routes:

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` (~1250 lines, `TeacherConsole`) | Main console: sign-in, class create/select, current-week control, invite links, retrieval weights, a course-wide textbook card, and weekly notes/slides PDF uploads with status polling. Entry states (auth bootstrap, sign-in card, config error) use the shared `.auth-screen`/`.auth-card`/`.boot-screen` design (owl video + Fraunces "Hoot" wordmark, loaded via `next/font` in `app/layout.tsx`); inline loading rows show a `boot-screen__bar` shimmer. |
| `/join/[code]` | `app/join/[code]/page.tsx` (`JoinPage`) | Teacher invite redemption: resolve code → auth → auto-redeem → redirect to `/`. All branches render on the shared entry-screen design; the brand subtitle is role-aware (`student` invites show "AI Teaching Assistant"). |
| `/report/[id]` | `app/report/[id]/page.tsx` (`ReportPage`) | AI-use report viewer: markdown render + copy / .md / .json / PDF export. |

All `app/api/**` files are thin pass-through proxies (`export const runtime = 'nodejs'`) that read `process.env.AI_TA_API_BASE_URL`, forward the incoming `Authorization` header and body, and return the backend response with `Cache-Control: no-store` (500 `"AI_TA_API_BASE_URL missing"` if the env var is unset; dynamic params are Next 15 style `Promise` ctx params).

| Proxy route (methods) | Backend endpoint |
|----------------------|------------------|
| `app/api/ask/route.ts` (POST) | `POST /ask` — streams `resp.body` through unbuffered |
| `app/api/chats/[chat_id]/route.ts` (POST) | `POST /chats/{chat_id}` |
| `app/api/classes/route.ts` (GET, POST) | `GET|POST /classes` |
| `app/api/my-classes/route.ts` (GET) | `GET /my-classes` |
| `app/api/invite-links/route.ts` (GET, POST) | `GET /invite-links?search_space_id=`, `POST /invite-links` |
| `app/api/invite-links/[id]/route.ts` (DELETE) | `DELETE /invite-links/{id}` (204 passed through bodyless) |
| `app/api/invite-links/resolve/[code]/route.ts` (GET) | `GET /invite-links/resolve/{code}` — unauthenticated; 502 on fetch failure |
| `app/api/invite-links/redeem/[code]/route.ts` (POST) | `POST /invite-links/redeem/{code}` — 502 on fetch failure |
| `app/api/teacher/weeks/route.ts` (GET) | `GET /teacher/weeks?search_space_id=` |
| `app/api/teacher/current-week/route.ts` (POST) | `POST /teacher/weeks/current` |
| `app/api/teacher/upload/route.ts` (POST) | `POST /teacher/upload` (re-sends `req.formData()` as multipart) |
| `app/api/teacher/uploads/[id]/retry/route.ts` (POST) | `POST /teacher/uploads/{id}/retry` |
| `app/api/teacher/retrieval-weights/route.ts` (GET, POST) | `GET|POST /teacher/retrieval-weights` |
| `app/api/reports/ai-use/[id]/route.ts` (GET, POST) | `GET /reports/ai-use/{id}`; POST creates a report where `[id]` is the **chat_id** |
| `app/api/reports/ai-use/[id]/pdf/route.ts` (GET) | `GET /reports/ai-use/{id}.pdf` (sets `Content-Disposition: attachment`) |

Note: `/api/ask`, `/api/chats/[chat_id]`, and the report-creation POST are not called by any page in this repo — they exist as proxies presumably for parity/other callers.

## Public interfaces

- `app/page.tsx` — default export `TeacherConsole()`, no props. Key local types: `ClassOption {id, slug, name, subject_name}`, `UploadSummary {id, week, kind: WeekKind|'textbook', title, status?, source_name?, page_count?, error_message?, ...}`, `WeekState {week, notes: SectionState, slides: SectionState}` (each `SectionState = {latest, history}`), `CourseState {search_space_id, course, slug, current_week, weeks[], textbook: SectionState}` (the course-wide textbook section), `RetrievalWeightResponse {search_space_id, course, weights, defaults, bounds:{min,max}}`, `InviteLink {id, code, search_space_id, role: 'student'|'teacher', is_active, max_uses, use_count, expires_at, created_at}`. Constants: `WEEK_KINDS = {notes, slides}`, `RESOURCE_WEIGHT_LABELS = {textbook, slides, notes}`, `MAX_WEEKS = 16`, `POLL_INTERVAL_MS = 4000`; upload statuses: `'queued'|'processing'|'ready'|'failed'|'superseded'` (`isPendingStatus` = queued/processing).
- `app/join/[code]/page.tsx` — default export `JoinPage()`; reads `code` via `useParams`. Types: `ResolvedLink {search_space_id, course_name, role}`, `RedeemResult {success, search_space_id, role, course_name}`.
- `app/report/[id]/page.tsx` — default export `ReportPage()`; reads `id` via `useParams`. Type: `Report {id, chat_id, created_at, style?, length?, markdown?, jsonld?: {evidence?: {truncated?}}, model_fingerprint?, prompt_hashes?}`.

## Main data flows

1. **Sign in / sign up (all pages)**: mount → `ensureActiveSession(loadStoredSession())` (see `ai-ta-teacher-ui/_overview`). No session → inline email/password form using `signInWithPassword` / `signUpWithPassword`; signup may return "check your email" notice. Session stored in localStorage; sign-out (header kebab menu on `/`) clears storage and resets all state.
2. **Create / select class** (`/`): `GET /api/my-classes` → `ClassOption[]`; first class auto-selected; empty list flips to the inline "create class" input → `POST /api/classes {name}` → appended to options and selected. Selecting a class triggers parallel `fetchWeeks`, `fetchWeights`, `fetchInviteLinks`.
3. **Upload materials** (`/`): per week (1..16 from `CourseState.weeks`) × kind (notes|slides), a file input (`accept="application/pdf"`) → `POST /api/teacher/upload` with FormData `{search_space_id, week, kind, title: "<Kind> · Week <n>", file}` → backend queues OCR/indexing. While any upload in any section's `history` is queued/processing, a `setInterval` polls `GET /api/teacher/weeks` every 4s in background mode (no loading spinner) until statuses settle. Failed attempts render an error row with a Retry button → `POST /api/teacher/uploads/{id}/retry`. A separate **Course textbook** card (above the weekly grid, from `CourseState.textbook`) uploads/replaces a course-wide textbook via `handleUploadTextbook` → `POST /api/teacher/upload {kind: 'textbook', week: '0', ...}`; the backend forces the sentinel week and indexes it with `week=NULL` so it is searched for every week.
4. **Set current week** (`/`): number input (clamped 1–16, `pendingWeek` state) + Update button → `POST /api/teacher/current-week {search_space_id, current_week}` → response is full `CourseState`, replaces state. UI copy: "Students see uploads through the active week."
5. **Tune retrieval weights** (`/`): `GET /api/teacher/retrieval-weights?search_space_id=` → sliders for `textbook`/`slides`/`notes` within `bounds` (step 0.01, rounded to 2dp). Save enabled only when dirty vs `serverWeights` (epsilon 0.0001) → `POST /api/teacher/retrieval-weights {search_space_id, weights}`; the POSTed `weights` echoes the full backend set (textbook/slides/notes/homework/exams/other) — only textbook/slides/notes are editable, the rest pass through unchanged; "Reset to defaults" copies `defaults` into local state (still requires Save).
6. **Invite links** (`/`): one active link per role (student/teacher). Generate/Regenerate → `POST /api/invite-links {search_space_id, role}`; Revoke → `DELETE /api/invite-links/{id}`; Copy builds URL `{base}/join/{code}` where base = `NEXT_PUBLIC_STUDENT_APP_URL` for student links, `window.location.origin` for teacher links.
7. **Join via invite** (`/join/[code]`): unauthenticated `GET /api/invite-links/resolve/{code}` shows course name (or "Invalid Invite Link"); once a session exists and the link resolved, a `useEffect` auto-fires `POST /api/invite-links/redeem/{code}` with Bearer token; on `success` shows "You're in!" and `router.push('/')` after 1.5s.
8. **View AI-use report** (`/report/[id]`): requires session → `GET /api/reports/ai-use/{id}` → renders `data.markdown` via `<ReactMarkdown>` inside `.teacher-prose`; warning banner if `jsonld.evidence.truncated`; "Prompts log" section extracts `(#turn-N)` anchors from the markdown (first 12 unique) as in-page links; sidebar shows chat_id, created_at, `model_fingerprint`, `prompt_hashes`. Exports: Copy / Blob-download .md / .json client-side; PDF via `GET /api/reports/ai-use/{id}/pdf` (uses `alert()` on failure).

## State

All state is component-local React hooks — no context, no store. `app/page.tsx` holds ~30 `useState` slots grouped as: auth (`authReady/session/authError/authNotice/email/password`), classes (`classOptions/selectedClassId/showCreateClass/newClassName`), course (`courseState/pendingWeek`), weights (`weights/serverWeights/defaultWeights/weightBounds`), invites (`inviteLinks/generatingInvite/copiedCode`), UI (`darkMode/headerMenuOpen/flash/error` — flash auto-clears after 4s), plus per-action busy flags (`savingWeek/uploadingKey/retryingUploadId/savingWeights/creatingClass`). Derived via `useMemo`: `hasPendingUploads`, `weightsDirty`, `canResetToDefaults`, `activeStudentLink/activeTeacherLink`.

## Key dependencies

- Backend (FastAPI, port 8000 locally via `AI_TA_API_BASE_URL`): full endpoint list in the proxy table above. Auth is enforced server-side from the forwarded Supabase Bearer JWT; the only unauthenticated call is invite resolution.
- Supabase: GoTrue auth REST only, via `app/lib/auth.ts` (`../lib/auth` / `../../lib/auth` relative imports). No direct DB access.
- UI libs: `framer-motion` (header menu enter/exit, week-card fade-in), `lucide-react` icons, `react-markdown` (report page only).

## Non-obvious conventions

- Uploads to `/teacher/upload` feed the backend indexing pipeline; "search_space_id" is the class id everywhere (`ClassOption.id === CourseState.search_space_id`).
- Replacement semantics: uploading again for the same week/kind supersedes the previous file (`'superseded'` status); UI shows `section.latest` plus pending/failed attempts found in `section.history` (excluding `latest`).
- Backend errors are surfaced by parsing `{ detail }` from FastAPI error bodies, falling back to raw text.
- `/join/[code]` and `/report/[id]` use plainer styling (`/join` uses raw gray/red Tailwind classes, not the `teacher-*` design system) — the polished theme lives mainly in `app/page.tsx` + `globals.css`.
- Theme toggle and outside-click menu close are wired with raw `document` listeners in `app/page.tsx`; theme persisted under localStorage key `theme`.
- API responses are trusted and cast (`as CourseState` etc.) — no runtime schema validation on either side of the proxies.

## Product context

These routes are the teacher's entire surface of Hoot: stand up a class, feed it weekly PDFs (which become the student AI's retrieval corpus), gate student visibility by current week, bias retrieval between slides and notes, invite students/co-teachers, and audit student AI usage via per-chat reports. Student-facing chat lives in the sibling `ai-ta-student-ui` app, which is why student invite URLs point at `NEXT_PUBLIC_STUDENT_APP_URL`.
