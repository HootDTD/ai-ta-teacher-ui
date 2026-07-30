---
doc: shell/app-entry
description: Root layout and build entry — RootLayout loads the Fraunces font and app metadata, next.config is empty (no rewrites), and the favicon is served by convention.
owns:
  - app/layout.tsx
  - next.config.ts
  - app/favicon.ico
related: [shell/styling, shell/console-orchestrator, api/_index]
last_verified: 2026-07-25
stub: false
---

# app-entry — root layout & build entry

## Interface

- `app/layout.tsx` — `RootLayout({ children })`, the App Router root layout.
  Loads the **Fraunces** Google font via `next/font/google`
  (`style: ["normal","italic"]`, `axes: ["opsz"]`, `display:"swap"`) exposing it
  as the `--font-fraunces` CSS variable on `<html>`. Sets `metadata` (title
  "Hoot Teacher Console"; description). Renders `<body className="antialiased">`
  and imports `./globals.css`.
- `next.config.ts` — an empty `NextConfig`. No rewrites, no custom config.
- `app/favicon.ico` — served by Next's file convention (no code reference).

## Data flow

No auth, no providers, no data. Layout is a pure shell; all auth and state live
client-side in `console-orchestrator` (`app/page.tsx`).

## Invariants & gotchas

- **All backend proxying is done by `app/api/**` route handlers, not
  `next.config` rewrites** — the empty config is load-bearing; adding rewrites
  here would fork the BFF pattern documented in [api/_index](../api/_index.md).
- Fraunces is the serif used by the `teacher-brand` / `auth-brand__wordmark`
  families in [styling](styling.md) — a font *is* loaded (corrects the old
  "no fonts loaded" note).
- Dev server runs on **port 3002** (`package.json` `dev` script, see
  [project-config](project-config.md)).

## Related

- Fonts consumed by the design system: [styling](styling.md).
