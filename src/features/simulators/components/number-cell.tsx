'use client';

import { useState } from 'react';

type Props = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
  /** Allow a decimal point (rates / CPI). Off → integer-only (months, NIS). */
  decimal?: boolean;
  ariaLabel?: string;
};

/**
 * Numeric field that shows a zero as an EMPTY input (placeholder "0") instead of
 * a literal "0" digit. On mobile that literal zero is painful: tapping in and
 * typing "4" yields "40" because you can't easily select-and-replace it. With an
 * empty field, typing "4" gives "4". Local string state preserves in-progress
 * input like "0." while a decimal is typed; the parsed number flows up via
 * onChange, and an upstream change (preset load, clear-all) re-seeds the text.
 */
export function NumberCell({ value, onChange, className, disabled, decimal = false, ariaLabel }: Props) {
  const [text, setText] = useState(() => numToText(value));

  // Re-seed when the upstream value changes to something the current text doesn't
  // already represent — render-phase sync (no useEffect), like other controlled
  // fields here. Comparing numerically avoids clobbering "0." mid-decimal.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (textToNum(text) !== value) setText(numToText(value));
  }

  const handle = (raw: string): void => {
    const allowed = decimal ? /^\d*\.?\d*$/ : /^\d*$/;
    if (!allowed.test(raw)) return; // reject letters / extra dots — keep the old text
    setText(raw);
    const next = textToNum(raw);
    if (Number.isFinite(next)) onChange(next);
  };

  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      className={className}
      disabled={disabled}
      value={text}
      placeholder="0"
      aria-label={ariaLabel}
      onChange={(e) => handle(e.target.value)}
    />
  );
}

function numToText(value: number): string {
  return value === 0 ? '' : String(value);
}

function textToNum(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' || trimmed === '.' ? 0 : Number(trimmed);
}
