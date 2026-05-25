'use client';

import { Tooltip } from '@/components/ui/tooltip';

/**
 * Icon-only action link that lives next to a borrower contact field
 * (phone → WhatsApp/Call, email → Mail). Extracted from CaseBorrowerCard
 * so the card stays under the component size limit; reusable from any
 * other borrower-contact surface that grows in the future.
 *
 * 'emerald' accent reads as "messaging app green" for WhatsApp; 'neutral'
 * keeps the rest aligned with the gold-tinted hover state used elsewhere.
 */
type Props = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  accent: 'emerald' | 'neutral';
  external?: boolean;
};

export function QuickIconLink({ href, label, icon: Icon, accent, external = false }: Props) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
      : 'text-neutral-500 hover:text-brand-gold-text hover:bg-neutral-100';
  return (
    <Tooltip content={label}>
      <a
        href={href}
        aria-label={label}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={`size-7 rounded inline-flex items-center justify-center transition ${accentClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40`}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </a>
    </Tooltip>
  );
}
