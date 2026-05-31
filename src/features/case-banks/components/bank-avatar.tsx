'use client';

import Image from 'next/image';
import { useState } from 'react';

import type { BankOption } from '../services/case-banks.service';

/**
 * Bank logo with a colored-initials fallback when the logo is missing or the
 * image fails to load. Shared by the inline banks list (picker rows) and each
 * bank row.
 */
export function BankAvatar({ bank }: { bank: BankOption }) {
  const [errored, setErrored] = useState(false);
  if (bank.logo_url && !errored) {
    return (
      <span className="size-7 relative rounded-lg bg-white border border-neutral-200 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
        <Image
          src={bank.logo_url}
          alt={bank.name_he}
          fill
          sizes="32px"
          onError={() => setErrored(true)}
          className="object-contain p-0.5"
          unoptimized={bank.logo_url.endsWith('.svg')}
        />
      </span>
    );
  }
  return (
    <span
      className="size-7 rounded-lg border border-neutral-200 flex items-center justify-center font-bold text-white shrink-0 shadow-sm text-[10px]"
      style={{ backgroundColor: bank.color }}
    >
      {bank.name_he.slice(0, 2)}
    </span>
  );
}
