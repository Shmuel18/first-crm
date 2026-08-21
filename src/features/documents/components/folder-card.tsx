'use client';

import {
  Briefcase,
  ChevronLeft,
  FileText,
  Files,
  Globe2,
  ShieldCheck,
  UserSquare2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { DriveFolder } from '../types';

type Props = {
  folder: DriveFolder;
  /** Current Drive display name; falls back to the localized category title. */
  title?: string;
  documentCount: number;
  missingCount: number;
  onOpen: (folder: DriveFolder) => void;
};

export const FOLDER_ICON: Record<DriveFolder, React.ComponentType<{ className?: string }>> = {
  identity: UserSquare2,
  income_il: Briefcase,
  income_abroad: Globe2,
  insurance_collateral: ShieldCheck,
  misc: Files,
};

const FOLDER_ACCENT: Record<DriveFolder, string> = {
  identity: 'border-sky-100 hover:border-sky-300 bg-sky-50/40',
  income_il: 'border-emerald-100 hover:border-emerald-300 bg-emerald-50/40',
  income_abroad: 'border-violet-100 hover:border-violet-300 bg-violet-50/40',
  insurance_collateral: 'border-amber-100 hover:border-amber-300 bg-amber-50/40',
  misc: 'border-slate-100 hover:border-slate-300 bg-slate-50/40',
};

export const FOLDER_ICON_TINT: Record<DriveFolder, string> = {
  identity: 'text-sky-700 bg-sky-100',
  income_il: 'text-emerald-700 bg-emerald-100',
  income_abroad: 'text-violet-700 bg-violet-100',
  insurance_collateral: 'text-amber-800 bg-amber-100',
  misc: 'text-slate-700 bg-slate-100',
};

/**
 * Compact, Drive-style folder box for the documents grid. Shows the category
 * icon, name, a one-line hint and at-a-glance counts (files + still-missing).
 * Clicking drills into the folder — files are never listed here ("not from
 * outside"); they appear inside FolderDetail.
 */
export function FolderCard({ folder, title, documentCount, missingCount, onOpen }: Props) {
  const t = useTranslations('documents.folders');
  const tc = useTranslations('documents.card');

  const Icon = FOLDER_ICON[folder];

  return (
    <button
      type="button"
      onClick={() => onOpen(folder)}
      className={`group focus-visible:ring-brand-gold-text/50 relative w-full rounded-xl border bg-white p-4 text-start shadow-sm transition hover:shadow-md focus-visible:ring-2 focus-visible:outline-none ${FOLDER_ACCENT[folder]}`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2.5 ${FOLDER_ICON_TINT[folder]}`}>
          <Icon className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm leading-tight font-semibold text-neutral-950">
            {title ?? t(`${folder}.title`)}
          </h2>
          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{t(`${folder}.subtitle`)}</p>
        </div>
        <ChevronLeft
          aria-hidden="true"
          className="size-4 shrink-0 text-neutral-400 transition group-hover:text-neutral-600 ltr:rotate-180 rtl:rotate-0"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-neutral-600">
          <FileText className="size-3.5" aria-hidden="true" />
          {tc('documentCount', { count: documentCount })}
        </span>
        {missingCount > 0 && (
          <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
            {tc('missingCount', { count: missingCount })}
          </span>
        )}
      </div>
    </button>
  );
}
