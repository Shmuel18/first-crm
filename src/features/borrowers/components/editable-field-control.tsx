import { Check, Loader2 } from 'lucide-react';

import type { FieldProps } from './editable-field-shared';
import { baseInputClass, errorInputClass } from './editable-field-shared';

/**
 * Internal renderer that picks the right primitive (input / select /
 * textarea) for an <EditableField>. Split out so the parent stays under
 * the component size limit and so a future date-only or rich-text variant
 * can fork this file without touching the orchestrator.
 */
export type ControlRenderProps = FieldProps & {
  id: string;
  /** Forwarded to the underlying <input>. Only used by type='date' to call
   *  showPicker() from the external calendar button. */
  inputRef: React.RefObject<HTMLInputElement | null>;
  localValue: string;
  setLocalValue: (v: string) => void;
  save: (v: string) => void;
  isPending: boolean;
  hasError: boolean;
  resolvedDir: 'ltr' | 'rtl' | 'auto' | undefined;
};

export function renderControl(p: ControlRenderProps) {
  const inputClass = [baseInputClass, p.hasError ? errorInputClass : ''].filter(Boolean).join(' ');

  if (p.type === 'textarea') {
    return (
      <textarea
        id={p.id}
        value={p.localValue}
        onChange={(e) => p.setLocalValue(e.target.value)}
        onBlur={(e) => p.save(e.target.value)}
        placeholder={p.placeholder}
        rows={p.rows ?? 2}
        disabled={p.disabled || p.isPending}
        dir={p.resolvedDir}
        className={`${inputClass} h-auto py-1.5 resize-y leading-snug`}
      />
    );
  }

  if (p.type === 'select' || p.type === 'tristate') {
    // Chevron on the left (RTL end-side) so it doesn't collide with the
    // selected option text starting from the right.
    return (
      <select
        id={p.id}
        value={p.localValue}
        onChange={(e) => {
          p.setLocalValue(e.target.value);
          p.save(e.target.value);
        }}
        disabled={p.disabled || p.isPending}
        className={`${inputClass} appearance-none ps-3 pe-7 bg-[length:1rem] bg-[left_0.5rem_center] bg-no-repeat`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23737373'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
        }}
      >
        <option value="">{p.placeholder ?? '— בחר —'}</option>
        {p.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  // For type='date': hide the browser's native calendar-picker indicator —
  // it carries an un-translatable, un-styleable tooltip. Our own <Tooltip>
  // wraps the external Calendar button instead.
  const dateClass = p.type === 'date' ? '[&::-webkit-calendar-picker-indicator]:hidden' : '';

  // For type='number': suppress the browser's up/down spinner buttons. They
  // don't add value for our use cases (IDs, currency, counts) and clutter
  // the input visually.
  const numberClass =
    p.type === 'number'
      ? '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]'
      : '';

  return (
    <input
      ref={p.inputRef}
      id={p.id}
      type={p.type}
      value={p.localValue}
      onChange={(e) => {
        const v = e.target.value;
        p.setLocalValue(v);
        // Date inputs commit instantly when the picker closes (no separate
        // blur event), so save on change instead of waiting for blur.
        if (p.type === 'date') p.save(v);
      }}
      onBlur={(e) => {
        // Date already saved on change; skip blur to avoid a no-op round trip.
        if (p.type === 'date') return;
        p.save(e.target.value);
      }}
      placeholder={p.placeholder}
      disabled={p.disabled || p.isPending}
      dir={p.resolvedDir}
      className={`${inputClass} ${dateClass} ${numberClass} ${p.inputClassName ?? ''}`}
    />
  );
}

/**
 * Save-state badge rendered to the right of an EditableField input. Always
 * reserves a 16px slot so the row layout doesn't reflow as state changes.
 */
export function SaveIndicator({ pending, error }: { pending: boolean; error: boolean }) {
  if (pending) {
    return (
      <span aria-hidden="true" className="size-4 shrink-0 inline-flex items-center justify-center">
        <Loader2 className="size-3.5 text-neutral-400 animate-spin" />
      </span>
    );
  }
  if (error) {
    return (
      <span aria-hidden="true" className="size-4 shrink-0 inline-flex items-center justify-center">
        <span className="block size-2 rounded-full bg-red-500" />
      </span>
    );
  }
  // Invisible placeholder so the grid is stable when there's nothing to show.
  return (
    <span aria-hidden="true" className="size-4 shrink-0 inline-flex items-center justify-center">
      <Check className="size-3.5 text-transparent" />
    </span>
  );
}
