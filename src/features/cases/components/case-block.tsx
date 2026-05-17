'use client';

import { useState } from 'react';

import { ChevronDown } from 'lucide-react';

type CaseBlockProps = {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
  fullWidth?: boolean;
};

export function CaseBlock({
  title,
  icon,
  defaultOpen = true,
  children,
  rightSlot,
  fullWidth,
}: CaseBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={[
        'bg-white border border-neutral-200 rounded-xl overflow-hidden',
        fullWidth ? 'md:col-span-2' : '',
      ].join(' ')}
    >
      <header className="flex items-center justify-between px-5 py-3.5 bg-neutral-50/60 border-b border-neutral-100">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 text-right group flex-1"
        >
          <span className="text-[#C9A961] [&_svg]:size-5">{icon}</span>
          <span className="font-display text-base font-medium text-neutral-900">{title}</span>
          <ChevronDown
            className={[
              'size-4 text-neutral-400 transition-transform',
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
