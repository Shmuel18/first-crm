'use client';

import { useId, useRef, useState, useTransition } from 'react';

import { Calendar, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { Tooltip } from '@/components/ui/tooltip';

type SaveResult = { ok: true } | { ok: false; message?: string };
type SelectOption = { value: string; label: string };

type CommonProps = {
  label: string;
  /** Current saved value. The component mirrors this into local state and
   *  rolls back to it when a save fails. */
  value: string | null | undefined;
  /** Async save. Should return ok/false; the parent is responsible for the
   *  optimistic UI of any DERIVED display (e.g. recomputed age). */
  onSave: (next: string | null) => Promise<SaveResult>;
  placeholder?: string;
  /** Suppress save attempts (e.g. while another action is pending). */
  disabled?: boolean;
  /** Icon / link rendered after the input (WhatsApp link, mailto, etc.). */
  adornment?: React.ReactNode;
  /** Override text direction. Defaults to auto for text, ltr for numeric. */
  dir?: 'ltr' | 'rtl' | 'auto';
};

type FieldProps = CommonProps &
  (
    | { type?: 'text' | 'email' | 'tel' | 'date' | 'number'; options?: undefined; rows?: undefined }
    | { type: 'textarea'; options?: undefined; rows?: number }
    | { type: 'select' | 'tristate'; options: ReadonlyArray<SelectOption>; rows?: undefined }
  );

const baseInputClass =
  'min-w-0 flex-1 h-9 px-2.5 rounded-md border border-neutral-200 bg-white text-sm text-neutral-900 ' +
  'shadow-xs focus:outline-none focus-visible:border-[#A88840] focus-visible:ring-2 focus-visible:ring-[#A88840]/40 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed transition';

const errorInputClass = 'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200';

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

  // Right-side label, input on the left (RTL natural order). Tight 5rem
  // label column so two fields fit comfortably side-by-side inside the
  // 2-column FieldGroup grid.
  return (
    <div className="grid grid-cols-[5rem_1fr] items-center gap-2 text-sm">
      <label htmlFor={id} className="text-neutral-500 truncate">
        {label}
      </label>
      <div className="flex items-center gap-1.5 min-w-0">
        {renderControl({ ...props, id, inputRef, localValue, setLocalValue, save, isPending, hasError, resolvedDir })}
        {type === 'date' && (
          <Tooltip content={tc('selectDate')}>
            <button
              type="button"
              onClick={openDatePicker}
              aria-label={tc('selectDate')}
              className="shrink-0 size-7 rounded inline-flex items-center justify-center text-neutral-500 hover:text-[#A88840] hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40 transition"
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

type ControlRenderProps = FieldProps & {
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

function renderControl(p: ControlRenderProps) {
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
    return (
      <select
        id={p.id}
        value={p.localValue}
        onChange={(e) => {
          p.setLocalValue(e.target.value);
          p.save(e.target.value);
        }}
        disabled={p.disabled || p.isPending}
        className={`${inputClass} appearance-none ps-2.5 pe-7 bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat`}
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
  const dateClass =
    p.type === 'date' ? '[&::-webkit-calendar-picker-indicator]:hidden' : '';

  return (
    <input
      ref={p.inputRef}
      id={p.id}
      type={p.type}
      value={p.localValue}
      onChange={(e) => p.setLocalValue(e.target.value)}
      onBlur={(e) => p.save(e.target.value)}
      placeholder={p.placeholder}
      disabled={p.disabled || p.isPending}
      dir={p.resolvedDir}
      className={`${inputClass} ${dateClass}`}
    />
  );
}

function SaveIndicator({ pending, error }: { pending: boolean; error: boolean }) {
  // 16px box always reserved so the input layout doesn't reflow when the
  // indicator appears mid-typing.
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
  // Render an invisible same-size placeholder so the grid is stable.
  return (
    <span aria-hidden="true" className="size-4 shrink-0 inline-flex items-center justify-center">
      <Check className="size-3.5 text-transparent" />
    </span>
  );
}

/** Read-only display row with the same label/value visual rhythm as
 *  EditableField, for derived values (computed age, etc.). */
export function ReadonlyField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[5rem_1fr] items-center gap-2 text-sm">
      <span className="text-neutral-500 truncate">{label}</span>
      <span
        className={`px-2.5 py-1.5 text-neutral-800 ${mono ? 'font-mono' : ''}`}
        dir={mono ? 'ltr' : undefined}
      >
        {value}
      </span>
    </div>
  );
}
