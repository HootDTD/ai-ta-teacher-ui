---
doc: api/reports-chat
description: BFF proxies for AI-use reports and Hoot chat — report get/create, report PDF export, the streaming /ask proxy, and the chat-turn proxy.
owns:
  - app/api/reports/ai-use/[id]/route.ts
  - app/api/reports/ai-use/[id]/pdf/route.ts
  - app/api/ask/route.ts
  - app/api/chats/[chat_id]/route.ts
related: [api/_index, routes/report, sections/reports]
last_verified: 2026-07-25
stub: false
---

# api/reports-chat

Report + Hoot-chat proxies. Uniform contract: [api/_index](_index.md).

## Interface (file → method → backend)

| File | Methods | Backend |
|---|---|---|
| `reports/ai-use/[id]/route.ts` | GET, POST | `/reports/ai-use/{id}` |
| `reports/ai-use/[id]/pdf/route.ts` | GET | `/reports/ai-use/{id}.pdf` |
| `ask/route.ts` | POST | `/ask` |
| `chats/[chat_id]/route.ts` | POST | `/chats/{chat_id}` |

## Invariants & gotchas

- **GET `reports/ai-use/[id]`** fetches a report; **POST** creates one where
  `[id]` is the `chat_id`.
- **`pdf`** forwards `resp.body` and sets `Content-Disposition: attachment` (falls
  back to `ai-use-report-{id}.pdf`).
- **`ask`** streams `resp.body` unbuffered (no `resp.text()`), preserving
  streaming to the client.
- This is the **Hoot-only** surface (relevant when `APOLLO_ONLY` is off). Only
  the report GET + pdf are wired to a page ([routes/report](../routes/report.md));
  `ask`, `chats/[chat_id]`, and report-create POST are unused by any page here —
  they exist as proxies for parity / other callers (likely legacy).

## Related

- Callers: [routes/report](../routes/report.md) (GET + pdf),
  [sections/reports](../sections/reports.md) (launcher).
