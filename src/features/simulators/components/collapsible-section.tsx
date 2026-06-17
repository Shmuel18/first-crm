'use client';

import { ChevronDown } from 'lucide-react';

import type { ReactNode } from 'react';

type Props = { title: string; open: boolean; onToggle: () => void; children: ReactNode };

/** A titled card whose header toggles its content open/closed. The title text is
 *  the button's accessible name; aria-expanded conveys state. */
export function CollapsibleSection({ title, open, onToggle, children }: Props) {
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition hover:bg-neutral-50"
      >
        <span className="min-w-0 break-words font-display text-lg font-semibold text-neutral-950">{title}</span>
        <ChevronDown className={`size-5 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? <div className="border-t border-neutral-100 p-4">{children}</div> : null}
    </section>
  );
}
