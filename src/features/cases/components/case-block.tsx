'use client';

import { useEffect, useRef, useState } from 'react';

import { ChevronDown } from 'lucide-react';

import type { CaseBlockKey } from '../domain/case-block-preferences';

import { useCaseBlockPrefs } from './case-block-prefs-context';

type CaseBlockProps = {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  /** When set, the open/closed default comes from the user's saved block
   *  preferences (Settings → Display), falling back to defaultOpen. */
  blockKey?: CaseBlockKey;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
  fullWidth?: boolean;
};

export function CaseBlock({
  title,
  icon,
  // Default closed — the case page is a stack of collapsed blocks the user
  // opens one at a time via the header chevron. Pass `defaultOpen` to
  // override per-block when a section needs to be revealed up front
  // (e.g. a dialog rendering a single block inline).
  defaultOpen = false,
  blockKey,
  children,
  rightSlot,
  fullWidth,
}: CaseBlockProps) {
  // A user's saved preference (if any) wins over the per-call default.
  const prefs = useCaseBlockPrefs();
  const initialOpen = blockKey && prefs ? prefs[blockKey] : defaultOpen;
  const [open, setOpen] = useState(initialOpen);
  const sectionRef = useRef<HTMLElement>(null);

  // On a user-driven expand, bring the block into view. A block low on the page
  // (e.g. the bottom "תיעוד" thread) otherwise opens entirely below the fold and
  // the user has to hunt for it. Skip the initial mount so a saved-open block
  // doesn't yank the page on load.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (open) sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [open]);

  return (
    <section
      ref={sectionRef}
      className={[
        'bg-white border border-neutral-200 rounded-xl overflow-hidden scroll-mt-4',
        fullWidth ? 'md:col-span-2' : '',
      ].join(' ')}
    >
      <header className="flex items-center justify-between px-5 py-3.5 bg-neutral-50/60 border-b border-neutral-100">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2.5 text-start group flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          <span aria-hidden="true" className="text-brand-gold-text [&_svg]:size-5">
            {icon}
          </span>
          <span className="font-display text-base font-medium text-neutral-900">{title}</span>
          <ChevronDown
            aria-hidden="true"
            className={[
              'size-4 text-neutral-500 transition-transform',
              open ? 'rotate-180' : '',
            ].join(' ')}
          />
        </button>
        {rightSlot && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {rightSlot}
          </div>
        )}
      </header>

      {open && <div className="p-5">{children}</div>}
    </section>
  );
}
