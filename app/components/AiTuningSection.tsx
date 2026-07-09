"use client";

import { RESOURCE_WEIGHT_LABELS, type RetrievalWeights, type WeightKind } from '../lib/teacher';

type Props = {
  weights: RetrievalWeights | null;
  defaultWeights: RetrievalWeights | null;
  weightBounds: { min: number; max: number } | null;
  loadingWeights: boolean;
  savingWeights: boolean;
  weightsDirty: boolean;
  canResetToDefaults: boolean;
  onWeightChange: (kind: WeightKind, value: number) => void;
  onSave: () => void;
  onReset: () => void;
};

export default function AiTuningSection({
  weights,
  defaultWeights,
  weightBounds,
  loadingWeights,
  savingWeights,
  weightsDirty,
  canResetToDefaults,
  onWeightChange,
  onSave,
  onReset,
}: Props) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold teacher-section-title">AI tuning</h1>
        <p className="text-sm teacher-muted">
          Adjust how much the AI prioritises each resource type when answering. Higher values push that material to
          the top of the results.
        </p>
      </header>

      <div className="rounded-3xl teacher-panel-soft p-5 space-y-4">
        {loadingWeights && (
          <div className="rounded-2xl teacher-panel-subtle px-4 py-4 text-sm teacher-muted flex items-center gap-3">
            <span className="boot-screen__bar" />
            Loading weights…
          </div>
        )}

        {!loadingWeights && weights && (
          <>
            <div className="space-y-3">
              {(Object.keys(RESOURCE_WEIGHT_LABELS) as WeightKind[]).map((kind) => {
                const label = RESOURCE_WEIGHT_LABELS[kind];
                const value = weights[kind];
                const defaultValue = defaultWeights?.[kind];
                return (
                  <div key={kind} className="rounded-2xl teacher-panel-subtle p-4 space-y-3">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm font-semibold teacher-section-title">{label}</div>
                      <div className="text-xs teacher-muted">
                        Current <span className="teacher-value">{value.toFixed(2)}</span>
                        {typeof defaultValue === 'number' && (
                          <span className="ml-3 teacher-muted">Default {defaultValue.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={weightBounds?.min ?? 0}
                      max={weightBounds?.max ?? 1}
                      step={0.01}
                      value={value}
                      onChange={(event) => onWeightChange(kind, Number(event.target.value))}
                      className="w-full teacher-range"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSave}
                disabled={!weightsDirty || savingWeights}
                className="teacher-button-primary h-11 rounded-2xl px-4 text-sm font-semibold"
              >
                {savingWeights ? 'Saving…' : weightsDirty ? 'Save weights' : 'Saved'}
              </button>
              <button
                type="button"
                onClick={onReset}
                disabled={!canResetToDefaults || savingWeights}
                className="teacher-button-secondary h-11 rounded-2xl px-4 text-sm font-semibold"
              >
                Reset to defaults
              </button>
            </div>
          </>
        )}

        {!loadingWeights && !weights && (
          <div className="rounded-2xl teacher-alert teacher-alert--danger px-4 py-4 text-sm">
            Failed to load retrieval weights. Please retry selecting the class.
          </div>
        )}
      </div>
    </div>
  );
}
