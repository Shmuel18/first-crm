'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GitCompareArrows, Layers, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = { basePath: string };

const TOOLS = [
  { segment: 'mix', key: 'mix', Icon: Layers },
  { segment: 'compare', key: 'compare', Icon: GitCompareArrows },
  { segment: 'scenario', key: 'scenario', Icon: TrendingUp },
] as const;

export function SimulatorToolsNav({ basePath }: Props) {
  const t = useTranslations('simulators.tools');
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label={t('label')}>
      {TOOLS.map(({ segment, key, Icon }) => {
        const href = `${basePath}/${segment}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={segment}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition ${
              active
                ? 'border-brand-gold-dark bg-brand-gold-soft text-brand-gold-text'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
