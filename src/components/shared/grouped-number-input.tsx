'use client';

import { useState } from 'react';

/** Strip to digits + a single decimal point (drops commas, signs, letters). */
function onlyNumeric(s: string): string {
  const cleaned = s.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  return dot === -1
    ? cleaned
    : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
}

/**
 * Group the integer part with thousands separators, preserving the decimal
 * part verbatim (no rounding). '1234.5' -> '1,234.5'; '7000' -> '7,000';
 * '' -> ''.
 */
function formatGrouped(raw: string): string {
  if (raw === '') return '';
  const dot = raw.indexOf('.');
  const intPart = dot === -1 ? raw : raw.slice(0, dot);
  const decPart = dot === -1 ? null : raw.slice(dot + 1);
  const n = intPart === '' ? null : Number(intPart);
  const groupedInt = n === null ? '' : Number.isFinite(n) ? n.toLocaleString('en-US') : intPart;
  return decPart === null ? groupedInt : `${groupedInt}.${decPart}`;
}

type Props = {
  /** Raw value — digits with an optional '.' (NOT grouped). */
  value: string;
  /** Receives the cleaned raw value on each keystroke. */
  onChange: (raw: string) => void;
  /** Receives the cleaned raw value on blur (the "save" moment). */
  onCommit: (raw: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  dir?: 'ltr' | 'rtl' | 'auto';
  inputMode?: 'numeric' | 'decimal';
  className?: string;
};

/**
 * Numeric input that shows thousands separators (7,000) at rest but reverts to
 * raw digits (7000) while focused, so the caret stays natural while typing.
 * Renders as type='text' because <input type='number'> rejects the comma
 * entirely. The committed value is always raw (digits + optional '.'), so each
 * caller's existing save / server contract is unchanged. Decimal-aware:
 * '1234.5' -> '1,234.5'.
 */
export function GroupedNumberInput({
  value,
  onChange,
  onCommit,
  id,
  placeholder,
  disabled,
  dir,
  inputMode = 'numeric',
  className,
}: Props) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value : formatGrouped(value);
  return (
    <input
      id={id}
      type="text"
      inputMode={inputMode}
      value={display}
      onChange={(e) => onChange(onlyNumeric(e.target.value))}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        setFocused(false);
        onCommit(onlyNumeric(e.target.value));
      }}
      placeholder={placeholder}
      disabled={disabled}
      dir={dir}
      className={className}
    />
  );
}
