---
doc: shell/styling
description: The entire design system as CSS (globals.css) — semantic teacher-*/auth-*/boot-* class families, the light/dark theme tokens, and the shared brand video asset.
owns:
  - app/globals.css
  - public/thinking.mp4
  - public/file.svg
  - public/globe.svg
  - public/next.svg
  - public/vercel.svg
  - public/window.svg
related: [shell/app-entry, shell/console-orchestrator, routes/report, sections/performance]
last_verified: 2026-07-30
stub: false
---

# styling — app/globals.css + brand assets

`globals.css` (~784 lines): `@import "tailwindcss"` (v4, no `tailwind.config.js`)
plus the whole design system expressed as CSS custom properties and semantic
classes. Style via these class names rather than re-reading the CSS.

## Interface (class families)

- **Layout chrome:** `teacher-layout`, `teacher-shell`, `teacher-main`,
  `teacher-topbar`, `teacher-sidebar`, `teacher-sidebar--open`,
  `teacher-sidebar__brand|owl|lockup|subtitle|nav`, `teacher-sidebar-item(--active)`,
  `teacher-sidebar-backdrop`, `header-menu`, `header-menu-item`,
  `header-menu-trigger`.
- **Surfaces:** `teacher-panel`, `teacher-panel-soft`, `teacher-panel-subtle`.
- **Controls:** `teacher-input`, `teacher-button-primary`,
  `teacher-button-secondary`, `teacher-range`, `teacher-value`.
- **Status:** `teacher-alert--danger|success|warning`,
  `teacher-pill--success|warning|danger|neutral`, `teacher-danger-text`,
  `teacher-icon-success|warning`.
- **Text/brand:** `teacher-muted`, `teacher-section-title`, `teacher-brand`
  (Fraunces serif), `teacher-prose`, `teacher-link`.
- **Week UI:** `teacher-week-pill`.
- **Auth/boot screens:** `auth-screen`, `auth-card`, `auth-brand`,
  `auth-brand__owl|wordmark|subtitle`, `auth-link-button`, `boot-screen`,
  `boot-screen__owl|wordmark|bar|label`.

## Data flow

Tokens are CSS vars on `:root` (light, warm-beige `#e9dfcf`) with a `html.dark`
override block; a transient `theme-transition` class animates the switch. Theme
is toggled/persisted by `console-orchestrator` (`localStorage['theme']`), not
here. `teacher-prose` styles the markdown in [routes/report](../routes/report.md).

**Chart marks:** `--chart-green` / `--chart-blue` / `--chart-red` (both `:root`
and `html.dark`) are the only sanctioned colors for data marks (bars, scatter
points) in [sections/performance](../sections/performance.md) — hexes chosen
and pairwise CVD-validated (dataviz skill's `validate_palette.js`, `--pairs
all`) against each theme's panel surface. Not semantically interchangeable
with the pre-existing `--success` / `--danger` text-alert tokens, which stay
scoped to `teacher-alert`/`teacher-pill` text and backgrounds.

## Invariants & gotchas

- **`public/thinking.mp4` is load-bearing** — the animated brand owl used by the
  boot screen, auth-brand, and the sidebar brand lockup (rendered via
  `mix-blend-mode` with `--owl-invert`/`--owl-blend` flipping per theme).
- The five `public/*.svg` are **unused** default create-next-app assets, owned
  here only to keep the ownership map total; safe to delete.
- Fraunces (the `--font-fraunces` var) is loaded in [app-entry](app-entry.md).

## Related

- Font source: [app-entry](app-entry.md). Theme toggle owner:
  [console-orchestrator](console-orchestrator.md).
