---
doc: routes/_index
description: Router for standalone full-page routes that render outside the console shell — the invite-redemption page and the AI-use report viewer.
owns: []
related: []
last_verified: 2026-07-25
stub: false
---

# routes — standalone full-page routes

Pages with their own full-page layout (no sidebar / console chrome).

| Leaf | One-liner | Owns |
|---|---|---|
| [join](join.md) | `/join/[code]` — resolve + auto-redeem a teacher/student invite | `app/join/[code]/page.tsx` |
| [report](report.md) | `/report/[id]` — AI-use report viewer with copy / download / PDF export | `app/report/[id]/page.tsx` |

## Cross-cutting invariants

- Both depend on [shell/auth-client](../shell/auth-client.md) for the session and
  both now use the shared `auth-*` / `boot-*` / `teacher-*` design system from
  [shell/styling](../shell/styling.md) (the join page was previously raw
  gray/red Tailwind — corrected).
