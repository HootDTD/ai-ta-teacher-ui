"use client";

import React from 'react';

export type CitationMeta = {
  label: string;
  doc_type?: string;
  file?: string;
  page?: number | null;
  ocr_conf?: number | null;
  bbox?: number[] | null;
  thumb?: string | null;
};

type Props = { meta: CitationMeta };

export function CitationChip({ meta }: Props) {
  const { label, doc_type, file, page, ocr_conf, thumb } = meta;
  return (
    <div className="relative inline-block group align-middle">
      <span className="inline-flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-200 hover:border-neutral-700 cursor-default">
        {label}
      </span>
      <div className="pointer-events-none absolute z-20 hidden group-hover:block">
        <div className="mt-1 w-64 rounded-md border border-neutral-800 bg-neutral-950 p-3 shadow-xl">
          <div className="text-xs text-neutral-400 mb-1">{doc_type || 'Reference'}</div>
          <div className="text-sm text-neutral-200 break-words">
            {file || '—'}{typeof page === 'number' ? ` • p. ${page}` : ''}
          </div>
          {typeof ocr_conf === 'number' && (
            <div className="mt-1 text-xs text-neutral-400">OCR confidence: {(ocr_conf * 100).toFixed(0)}%</div>
          )}
          {thumb && (
            <div className="mt-2 rounded overflow-hidden border border-neutral-800">
              <img src={thumb} alt={label} className="w-full h-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

