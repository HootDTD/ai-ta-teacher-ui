---
doc: sections/ai-tuning
description: AiTuningSection — presentational retrieval-weight sliders (textbook/slides/notes) with dirty-gated Save and Reset-to-defaults; hidden on Apollo-only deployments.
owns:
  - app/components/AiTuningSection.tsx
related: [shell/console-orchestrator, shell/console-types, api/materials]
last_verified: 2026-07-25
stub: false
---

# ai-tuning — AiTuningSection

Presentational (~107 lines, default export). Hoot-only — hidden when
`APOLLO_ONLY` is set.

## Interface

Props: `weights`, `defaultWeights`, `weightBounds{min,max}`, `loadingWeights`,
`savingWeights`, `weightsDirty`, `canResetToDefaults`,
`onWeightChange(kind, value)`, `onSave`, `onReset`.

## Data flow

Renders one range slider (`step 0.01`, bounded by `weightBounds`) per
`RESOURCE_WEIGHT_LABELS` key (`textbook`/`slides`/`notes`), showing current +
default values; a **Save** button enabled only when `weightsDirty`, and a
**Reset to defaults** button enabled only when `canResetToDefaults`. Also renders
loading and load-failure states. All weight state and the POST live in
`console-orchestrator` (`handleWeightChange` / `handleSaveWeights` /
`handleResetWeights`, plus the dirty/reset memos).

## Invariants & gotchas

- These weights are the **post-fusion per-store-kind retrieval bias** the backend
  applies — this section only edits three of them; the full weight set is echoed
  back on save.

## Env flags

- `APOLLO_ONLY` — this section is in `HOOT_ONLY_SECTIONS`, so it does not render
  on the Apollo pilot deployment.

## Related

- State owner + POST: [console-orchestrator](../shell/console-orchestrator.md).
- Proxy: [api/materials](../api/materials.md) (`retrieval-weights`).
