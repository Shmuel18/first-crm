import { Check, Loader2 } from 'lucide-react';

import { GroupedNumberInput } from '@/components/shared/grouped-number-input';

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
  /** Empty-option label for selects (i18n'd by the parent — this renderer is
   *  a plain function and can't call useTranslations). Falls back to '—'. */
  selectPlaceholder?: string;
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
    // Chevron pinned to the END side (logical): left in RTL, right in LTR, so
    // it never collides with the option text and flips correctly per locale.
    // pe-7 already reserves the end-side padding for it.
    return (
      <select
        id={p.id}
        value={p.localValue}
        onChange={(e) => {
          p.setLocalValue(e.target.value);
          p.save(e.target.value);
        }}
        disabled={p.disabled || p.isPending}
        className={`${inputClass} appearance-none ps-3 pe-7 bg-[length:1rem] bg-no-repeat rtl:bg-[left_0.5rem_center] ltr:bg-[right_0.5rem_center]`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23737373'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
        }}
      >
        <option value="">{p.placeholder ?? p.selectPlaceholder ?? '—'}</option>
        {p.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  // Date inputs are UNCONTROLLED while editing. A controlled `value={}` re-renders
  // on every keystroke, and the native date field then resets the year segment
  // mid-entry — you could only ever land on a "000x" year. `defaultValue` + a
  // `key` tied to the committed value lets the browser own the segments while
  // typing; we commit on blur, and the key remounts the field only when the
  // value is set externally (the calendar picker, or a parent resync/rollback).
  // The webkit calendar indicator stays hidden — the external <DatePickerPopover>
  // button drives the picker.
  if (p.type === 'date') {
    return (
      <input
        ref={p.inputRef}
        id={p.id}
        type="date"
        key={p.value ?? ''}
        defaultValue={p.localValue}
        onBlur={(e) => p.save(e.target.value)}
        placeholder={p.placeholder}
        disabled={p.disabled || p.isPending}
        dir={p.resolvedDir}
        className={`${inputClass} [&::-webkit-calendar-picker-indicator]:hidden ${p.inputClassName ?? ''}`}
      />
    );
  }

  // Grouped-number opt-in: thousands separators (7,000) at rest, raw digits
  // while editing. <input type='number'> can't display a comma, so this path
  // renders as text. The committed value stays raw digits (see below).
  if (p.type === 'number' && p.groupThousands) {
    return (
      <GroupedNumberInput
        id={p.id}
        value={p.localValue}
        onChange={p.setLocalValue}
        onCommit={p.save}
        placeholder={p.placeholder}
        disabled={p.disabled || p.isPending}
        dir={p.resolvedDir}
        className={`${inputClass} text-end ${p.inputClassName ?? ''}`}
      />
    );
  }

  // For type='number': suppress the browser's up/down spinner buttons. They
  // don't add value for our use cases (IDs, currency, counts) and clutter
  // the input visually. Also right-align (text-end on an LTR input resolves
  // to right) so the digits hug the label side of the row in RTL — without
  // this, numbers float to the LTR start (left of the box).
  const numberClass =
    p.type === 'number'
      ? '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield] text-end'
      : '';

  // Mobile keyboard hint: pick the right virtual keyboard per field type.
  // `tel` for phone numbers, `email` for email, `numeric` for currency /
  // counts (decimal would show a "." key on iOS which we don't need).
  const inputMode =
    p.type === 'number' ? 'numeric'
      : p.type === 'tel' ? 'tel'
      : p.type === 'email' ? 'email'
      : undefined;

  return (
    <input
      ref={p.inputRef}
      id={p.id}
      type={p.type}
      inputMode={inputMode}
      value={p.localValue}
      onChange={(e) => p.setLocalValue(e.target.value)}
      onBlur={(e) => p.save(e.target.value)}
      placeholder={p.placeholder}
      disabled={p.disabled || p.isPending}
      dir={p.resolvedDir}
      className={`${inputClass} ${numberClass} ${p.inputClassName ?? ''}`}
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
