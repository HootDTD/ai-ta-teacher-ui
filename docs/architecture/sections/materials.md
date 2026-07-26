---
doc: sections/materials
description: MaterialsSection — presentational course-materials view (active-week control, course-wide textbook card, collapsible weekly notes/slides upload timeline).
owns:
  - app/components/MaterialsSection.tsx
related: [shell/console-orchestrator, shell/console-types, api/materials]
last_verified: 2026-07-25
stub: false
---

# materials — MaterialsSection

Presentational (~369 lines, default export). All data + handlers come from
`console-orchestrator`.

## Interface

Props: `courseState`, `loading`, `pendingWeek` / `onPendingWeekChange`,
`savingWeek` / `onSaveCurrentWeek`, `hasPendingUploads`, `uploadingKey`,
`retryingUploadId`, `onUpload(file, week, kind)`, `onUploadTextbook(file)`,
`onRetry(upload)`. Internal sub-components `UploadSlot` and `WeekRow` (local
`expandedWeeks: Set<number>`).

## Data flow

Renders three regions: (1) an **active-week** number control clamped to
`1..MAX_WEEKS`, calling `onSaveCurrentWeek`; (2) a **course-wide textbook** card
(separate from the weekly grid) with `onUploadTextbook` + retry; (3) the
**weekly timeline** — one collapsible `WeekRow` per `courseState.weeks`, each
with notes + slides `UploadSlot`s showing latest / pending / failed(+Retry) from
`section.history`. The active week auto-expands. Accepts `application/pdf` only.
No fetching — it only renders and calls back.

## Invariants & gotchas

- A pending or failed attempt is derived from `section.history` (not just
  `latest`), so a replacement in flight shows "processing" over the current file.
- Uploads/retries feed the backend OCR/indexing pipeline via
  [api/materials](../api/materials.md).

## Related

- State owner: [console-orchestrator](../shell/console-orchestrator.md).
- Types (`CourseState`, `WeekState`, `UploadSummary`): [console-types](../shell/console-types.md).
