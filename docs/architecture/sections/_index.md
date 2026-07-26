---
doc: sections/_index
description: Router for the dumb, presentational console sections — Materials, AI Tuning, Invites, Reports — which receive all state and callbacks from the page.tsx orchestrator.
owns: []
related: [shell/navigation, shell/console-orchestrator]
last_verified: 2026-07-25
stub: false
---

# sections — orchestrator-fed console sections

Presentational sections rendered inside the console shell. They do **no fetching
of their own** — every bit of state and every callback comes from
`console-orchestrator` (`app/page.tsx`) as props. Contrast with
[authoring/](../authoring/_index.md), whose panels are self-fetching.

| Leaf | One-liner | Owns |
|---|---|---|
| [materials](materials.md) | active-week control + course textbook + weekly notes/slides upload timeline | `app/components/MaterialsSection.tsx` |
| [ai-tuning](ai-tuning.md) | retrieval-weight sliders (textbook/slides/notes) with save + reset | `app/components/AiTuningSection.tsx` |
| [invites](invites.md) | one active student + one active teacher join link, per role | `app/components/InvitesSection.tsx` |
| [reports](reports.md) | report-ID launcher that pushes to the standalone report viewer | `app/components/ReportsSection.tsx` |

## Cross-cutting invariants

- **Dumb by contract.** Fetch/poll/handler logic for all four lives in
  `console-orchestrator`; these components only render props and call callbacks.
  Do not add fetching here.
- **Gated by `activeSection`.** Each renders only when its `SectionKey` is active.
  `ai-tuning` + `reports` are Hoot-only and hidden when `APOLLO_ONLY` is set
  (`HOOT_ONLY_SECTIONS` in `page.tsx`).

## Recipe — add a console section (back-links)

Adding a section is driven from the shell: edit the `SectionKey` union in
[shell/navigation](../shell/navigation.md), then `ALL_SECTIONS` /
`HOOT_ONLY_SECTIONS` + a render branch in
[shell/console-orchestrator](../shell/console-orchestrator.md), add the component
(a dumb one here or a self-fetching one under authoring/), and any proxy under
[api/](../api/_index.md). Full recipe: [shell/_index](../shell/_index.md).
