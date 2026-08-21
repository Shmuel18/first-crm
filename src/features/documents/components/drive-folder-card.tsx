'use client';

import { ChevronLeft, FileText, Folder } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { DriveFolderNode } from '../types';

type Props = {
  folder: DriveFolderNode;
  documentCount: number;
  onOpen: (folderId: string) => void;
};

/** A custom top-level Drive folder, including an empty one. */
export function DriveFolderCard({ folder, documentCount, onOpen }: Props) {
  const tc = useTranslations('documents.card');

  return (
    <button
      type="button"
      onClick={() => onOpen(folder.id)}
      className="group focus-visible:ring-brand-gold-text/50 w-full rounded-xl border border-slate-100 bg-slate-50/40 p-4 text-start shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-slate-100 p-2.5 text-slate-700">
          <Folder className="size-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-sm leading-tight font-semibold text-neutral-950">
            {folder.name}
          </h2>
          <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
            <FileText className="size-3.5" aria-hidden="true" />
            {tc('documentCount', { count: documentCount })}
          </span>
        </div>
        <ChevronLeft
          aria-hidden="true"
          className="size-4 shrink-0 text-neutral-400 transition group-hover:text-neutral-600 ltr:rotate-180"
        />
      </div>
    </button>
  );
}
