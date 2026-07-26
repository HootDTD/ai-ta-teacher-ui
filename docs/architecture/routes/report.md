---
doc: routes/report
description: ReportPage (/report/[id]) — the AI-use report viewer that renders report markdown and offers copy, .md/.json download, and server-side PDF export.
owns:
  - app/report/[id]/page.tsx
related: [shell/auth-client, shell/styling, api/reports-chat, sections/reports]
last_verified: 2026-07-25
stub: false
---

# report — /report/[id]

Standalone page (~228 lines, default export `ReportPage`), reads `id` via
`useParams`.

## Interface

Type `Report` (`id`, `chat_id`, `created_at`, optional `style`/`length`/
`markdown`, `jsonld.evidence.truncated`, `model_fingerprint`, `prompt_hashes[]`).

## Data flow

Requires a session (`ensureActiveSession`); then
`GET /api/reports/ai-use/{id}` with the `Bearer` token. Renders `data.markdown`
via `<ReactMarkdown>` inside `.teacher-prose`. A truncation banner shows when
`jsonld.evidence.truncated`. A "Prompts log" extracts `(#turn-N)` anchors (first
12 unique) as in-page links. Sidebar shows `chat_id` / `created_at` /
`model_fingerprint` / `prompt_hashes`. Exports: Copy, client-side Blob
`.md` / `.json` download, and PDF via `GET /api/reports/ai-use/{id}/pdf`
(`alert` on failure).

## Invariants & gotchas

- Reached from the [sections/reports](../sections/reports.md) launcher.
- Uses the `teacher-*` design system; PDF is generated backend-side (weasyprint),
  this page only streams the download.

## Related

- Auth: [shell/auth-client](../shell/auth-client.md). Proxies (GET + pdf):
  [api/reports-chat](../api/reports-chat.md).
