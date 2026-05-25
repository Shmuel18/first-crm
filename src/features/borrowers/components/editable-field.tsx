'use client';

import { useId, useRef, useState, useTransition } from 'react';

import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { Tooltip } from '@/components/ui/tooltip';

import { renderControl, SaveIndicator } from './editable-field-control';
import type { FieldProps } from './editable-field-shared';

export type { FieldProps, SaveResult, SelectOption } from './editable-field-shared';

export function EditableField(props: FieldProps) {
  const { label, value, onSave, adornment, type = 'text', dir } = props;
  const id = useId();
  const tc = useTranslations('common');
  // Ref forwarded to the underlying input so the date-picker button can call
  // showPicker() — only relevant when type='date', but useRef is unconditional.
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value ?? '');
  const [hasError, setHasError] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Re-sync local state when the server-provided value changes (rollback on
  // error, revalidation after a sibling save). React's "adjust state on prop
  // change" pattern: a render-phase setState is preferred over a useEffect
  // (the linter blocks the effect variant in React 19).
  const [propRef, setPropRef] = useState(value ?? '');
  if ((value ?? '') !== propRef) {
    setPropRef(value ?? '');
    setLocalValue(value ?? '');
    setHasError(false);
  }

  const save = (next: string) => {
    const normalized = next.trim();
    const currentSaved = (value ?? '').trim();
    if (normalized === currentSaved) {
      setHasError(false);
      return;
    }
    setHasError(false);
    startTransition(async () => {
      const result = await onSave(normalized === '' ? null : normalized);
      if (!result.ok) {
        setHasError(true);
        setLocalValue(value ?? ''); // rollback to last saved
        toast.error(result.message || 'שמירה נכשלה');
      }
    });
  };

  // Resolve direction: LTR for numbers/dates/email/tel (Latin-leaning), else
  // let the page direction win. Caller's explicit `dir` always overrides.
  const resolvedDir =
    dir ??
    (type === 'number' || type === 'date' || type === 'email' || type === 'tel'
      ? 'ltr'
      : undefined);

  const openDatePicker = () => {
    // showPicker() is available in modern browsers (Chrome 99+, FF 101+,
    // Safari 16.4+). Optional-chain so older browsers just no-op — the user
    // can still click the input itself to focus it.
    inputRef.current?.showPicker?.();
  };

  // Right-side label, input on the left (RTL natural order). Tight 6rem
  // label column so two fields fit comfortably side-by-side inside the
  // 2-column FieldGroup grid.
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm">
      <label htmlFor={id} className="text-neutral-500 truncate">
        {label}
      </label>
      <div className="flex items-center gap-1.5 min-w-0">
        {renderControl({
          ...props,
          id,
          inputRef,
          localValue,
          setLocalValue,
          save,
          isPending,
          hasError,
          resolvedDir,
        })}
        {type === 'date' && (
          <Tooltip content={tc('selectDate')}>
            <button
              type="button"
              onClick={openDatePicker}
              aria-label={tc('selectDate')}
              className="shrink-0 size-7 rounded inline-flex items-center justify-center text-neutral-500 hover:text-brand-gold-text hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition"
            >
              <Calendar className="size-3.5" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
        {adornment ? <div className="shrink-0">{adornment}</div> : null}
        <SaveIndicator pending={isPending} error={hasError} />
      </div>
    </div>
  );
}
