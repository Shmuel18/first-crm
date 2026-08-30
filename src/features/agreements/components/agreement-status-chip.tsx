'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatDateShort } from '@/lib/utils/format-date';
import type { Locale } from '@/lib/i18n/direction';

import type { AgreementState } from '../types';

export function AgreementStatusChip({ state, locale }: { state: AgreementState; locale: Locale }) {
  const t = useTranslations('agreements.block');
  if (state.kind === 'signed') {
    const method =
      state.agreement.signedMethod === 'manual' ? t('methodManual') : t('methodDigital');
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        {t('statusSigned', { date: formatDateShort(state.agreement.signedAt, locale) })}
        <span className="font-normal text-emerald-600">· {method}</span>
      </span>
    );
  }
  if (state.kind === 'sent') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          state.expired ? 'bg-red-50 text-red-700' : 'bg-brand-gold-soft text-brand-gold-text'
        }`}
      >
        {state.expired
          ? t('statusExpired', { date: formatDateShort(state.agreement.sentAt, locale) })
          : t('statusSent', { date: formatDateShort(state.agreement.sentAt, locale) })}
      </span>
    );
  }
  return <span className="text-xs text-neutral-500">{t('statusNone')}</span>;
}

export function AgreementSmallButton({
  onClick,
  label,
  icon,
  disabled,
}: {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
    >
      {icon && (
        <span aria-hidden="true" className="[&_svg]:block">
          {icon}
        </span>
      )}
      {label}
    </button>
  );
}
