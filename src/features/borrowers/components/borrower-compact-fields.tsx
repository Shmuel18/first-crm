'use client';

import { useState } from 'react';

/**
 * Tiny inline-label field primitives used by the dense merged row on
 * CaseBorrowerCard (children / age / foreign / language). Each renders as
 * "label: [tiny input]" instead of EditableField's label-column +
 * input-column layout, so 4 fields plus an address can share one line.
 *
 * Lives outside the card file so the card stays under the component size
 * limit and so a future caller (e.g. a borrower mini-card) can reuse them.
 */

export function FieldGroup({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
}) {
  // Borrower cards are stacked full-width now, so denser column counts are
  // viable. 3-col for identity (name | last | id), 4-col for the misc row
  // (children | age | foreign | language), 2-col stays default.
  const colsClass =
    cols === 4 ? 'sm:grid-cols-4' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <div
      className={`grid grid-cols-1 ${colsClass} gap-x-6 gap-y-2 pb-3 border-b border-neutral-100 last:border-0 last:pb-0`}
    >
      {children}
    </div>
  );
}

export function CompactNumber({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number | null;
  onSave: (next: number | null) => unknown;
}) {
  const [local, setLocal] = useState(value === null || value === undefined ? '' : String(value));
  const [propRef, setPropRef] = useState(value);
  if (value !== propRef) {
    setPropRef(value);
    setLocal(value === null || value === undefined ? '' : String(value));
  }
  return (
    <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-neutral-500">{label}:</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step="1"
        dir="ltr"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => {
          const v = e.target.value.trim();
          const next = v === '' ? null : Number(v);
          if (next !== value) onSave(next);
        }}
        className="w-12 h-8 px-1.5 text-center rounded-md border border-neutral-200 bg-white text-sm focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
      />
    </label>
  );
}

export function CompactReadonly({ label, value }: { label: string; value: string | null }) {
  // Disabled input so the age slot matches the visual shape of the editable
  // boxes around it — same border/radius/height, just non-interactive.
  return (
    <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-neutral-500">{label}:</span>
      <input
        type="text"
        value={value ?? '—'}
        disabled
        readOnly
        className="w-14 h-8 px-2 text-center rounded-md border border-neutral-200 bg-neutral-50 text-sm font-mono text-neutral-700 cursor-default"
      />
    </label>
  );
}

export function CompactSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  // Arrow positioned on the LEFT (the "end" side in RTL): text now starts
  // from the right edge with breathing room, no collision with the chevron.
  return (
    <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-neutral-500">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 ps-3 pe-7 rounded-md border border-neutral-200 bg-white text-sm appearance-none bg-[length:1rem] bg-[left_0.5rem_center] bg-no-repeat focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23737373'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
