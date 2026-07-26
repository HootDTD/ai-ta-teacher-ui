---
doc: sections/reports
description: ReportsSection — a trivial self-contained launcher that pushes a typed report ID to the standalone /report/[id] viewer; Hoot-only.
owns:
  - app/components/ReportsSection.tsx
related: [routes/report, api/reports-chat]
last_verified: 2026-07-25
stub: false
---

# reports — ReportsSection

Small (~59 lines, default export). Self-contained but trivial — unlike the other
sections it holds a tiny local input, not orchestrator state.

## Interface

No props. Local `reportId` input state; `useRouter()`.

## Data flow

On submit, `router.push('/report/{encodeURIComponent(id)}')` — it is just a
launcher; the actual report render / copy / download / PDF export lives in the
standalone [routes/report](../routes/report.md) page. No fetching here.

## Invariants & gotchas

- Hoot-only: hidden when `APOLLO_ONLY` (the Apollo student deployment has Hoot
  Q&A off, so there are no AI-use reports to open).

## Env flags

- `APOLLO_ONLY` — in `HOOT_ONLY_SECTIONS`; not rendered on the Apollo deployment.

## Related

- Viewer: [routes/report](../routes/report.md). Report proxies:
  [api/reports-chat](../api/reports-chat.md).
