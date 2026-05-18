'use client';

import { useState } from 'react';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

type CopyableIdCellProps = {
  value: string | null | undefined;
};

export function CopyableIdCell({ value }: CopyableIdCellProps) {
  const tc = useTranslations('common');
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className="text-neutral-400">—</span>;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API not available - silent fail
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={tc('copied')}
      className="group inline-flex items-center gap-1.5 font-mono tabular-nums text-xs text-neutral-500 hover:text-[#C9A961] transition relative"
      dir="ltr"
    >
      <span>{value}</span>
      {copied ? (
        <Check className="size-3 text-emerald-600" />
      ) : (
        <Copy className="size-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition" />
      )}
      {copied && (
        <span className="absolute top-full start-0 mt-1 px-2 py-0.5 bg-emerald-600 text-white text-[10px] rounded whitespace-nowrap pointer-events-none">
          {tc('copied')}
        </span>
      )}
    </button>
  );
}
