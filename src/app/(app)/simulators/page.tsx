import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  ArrowLeft,
  BadgePercent,
  Calculator,
  FileText,
  GitCompareArrows,
  Layers,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { userHasPermission } from '@/lib/auth/permissions';

const AVAILABLE_TOOLS = [
  { href: '/simulators/mix', key: 'mix', Icon: Layers },
  { href: '/simulators/compare', key: 'compare', Icon: GitCompareArrows },
  { href: '/simulators/scenario', key: 'scenario', Icon: TrendingUp },
  { href: '/simulators/affordability', key: 'affordability', Icon: WalletCards },
  { href: '/simulators/tax', key: 'tax', Icon: ReceiptText },
] as const;

const NEXT_TOOLS = [
  { key: 'refinance', Icon: BadgePercent },
  { key: 'earlyRepayment', Icon: ShieldAlert },
  { key: 'clientReport', Icon: FileText },
] as const;

export default async function SimulatorsPage() {
  if (!(await userHasPermission('view_simulators'))) redirect('/cases');
  const t = await getTranslations('simulators.hub');
  const tTools = await getTranslations('simulators.tools');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
            <Calculator className="size-4" aria-hidden="true" />
            {t('eyebrow')}
          </div>
          <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">{t('subtitle')}</p>
        </div>
        <Link
          href="/simulators/mix"
          className="inline-flex h-11 w-fit items-center gap-2 rounded-lg bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          {t('primaryAction')}
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
      </header>

      <section aria-labelledby="simulators-live-title" className="space-y-3">
        <h2 id="simulators-live-title" className="font-display text-xl font-semibold text-neutral-950">
          {t('availableTitle')}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {AVAILABLE_TOOLS.map(({ href, key, Icon }) => (
            <Link
              key={key}
              href={href}
              className="group rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-gold-dark hover:shadow-md"
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <span className="inline-flex size-11 items-center justify-center rounded-lg bg-brand-gold-soft text-brand-gold-text">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <ArrowLeft className="size-4 text-neutral-400 transition group-hover:-translate-x-1 group-hover:text-brand-gold-text" />
              </div>
              <h3 className="font-display text-lg font-semibold text-neutral-950">{tTools(key)}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{t(`${key}.description`)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="simulators-next-title" className="space-y-3">
        <h2 id="simulators-next-title" className="font-display text-xl font-semibold text-neutral-950">
          {t('nextTitle')}
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {NEXT_TOOLS.map(({ key, Icon }) => (
            <div key={key} className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-white text-neutral-500">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="font-display text-base font-semibold text-neutral-800">{t(`${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{t(`${key}.description`)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
