'use client';

import { Bell, Mail, Pencil, ShieldCheck, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { SystemEmailTemplateSummary } from '../services/system-email-templates.service';

const CATEGORY_ICON = {
  security: ShieldCheck,
  clients: Mail,
  staff: Users,
  operations: Bell,
} as const;

type Props = {
  template: SystemEmailTemplateSummary;
  locale: 'he' | 'en';
  onEdit: (template: SystemEmailTemplateSummary) => void;
};

export function SystemTemplateRow({ template, locale, onEdit }: Props) {
  const t = useTranslations('templates.automatic');
  const version = template.versions[locale];
  const Icon = CATEGORY_ICON[template.category];

  return (
    <li className="flex items-start gap-3 px-4 py-3.5 hover:bg-neutral-50/70">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold-soft text-brand-gold-text">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-neutral-900">{t(`names.${template.key}`)}</p>
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">
            {t(`categories.${template.category}`)}
          </span>
          {template.critical ? (
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
              {t('critical')}
            </span>
          ) : (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                version.isEnabled
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {version.isEnabled ? t('enabled') : t('disabled')}
            </span>
          )}
          {version.isCustomized && (
            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-800">
              {t('customized')}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-neutral-600">{version.subject}</p>
        <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{version.body}</p>
      </div>
      <button
        type="button"
        onClick={() => onEdit(template)}
        aria-label={t('editName', { name: t(`names.${template.key}`) })}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100 hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
      >
        <Pencil className="size-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

