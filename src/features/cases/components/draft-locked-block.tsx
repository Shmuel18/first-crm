'use client';

import { LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CaseBlock } from './case-block';

/**
 * Thin wrapper that renders the same chrome as a live case-page block, with
 * placeholder content as children. The block looks identical to a real-but-
 * empty case-detail block — no opacity, no lock icon, no "save first" footer.
 * The user knows they're on a draft from the gold action bar at the top
 * ("תיק חדש · טרם נשמר"); inside the page everything reads as a regular
 * empty case.
 */

type Props = {
  title: string;
  icon: React.ReactNode;
  fullWidth?: boolean;
  /** Same slot used by live blocks for a header summary (e.g. "0 ₪").
   *  Forwarded as-is to CaseBlock so the draft chrome matches the live
   *  page when blocks normally surface a summary there. */
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
};

export function DraftLockedBlock({ title, icon, fullWidth, rightSlot, children }: Props) {
  const t = useTranslations('case.draft.locked');
  const hint = (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
      <LockKeyhole className="size-3.5 text-brand-gold-text" aria-hidden="true" />
      {t('hint')}
    </span>
  );

  return (
    <CaseBlock
      title={title}
      icon={icon}
      fullWidth={fullWidth}
      rightSlot={
        <div className="flex items-center gap-3">
          {rightSlot}
          {hint}
        </div>
      }
    >
      {children ?? (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-4 py-6 text-center text-sm text-neutral-600">
          {t('hint')}
        </div>
      )}
    </CaseBlock>
  );
}
