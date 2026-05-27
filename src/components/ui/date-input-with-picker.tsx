'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { DatePickerPopover } from '@/components/ui/date-picker-popover';
import { Input } from '@/components/ui/input';

type CommonProps = {
  disabled?: boolean;
  /** Accessible label for the calendar trigger button (e.g. "תאריך לידה"). */
  pickerLabel?: string;
  /** Additional class names appended to the input element. */
  className?: string;
  /** Optional id forwarded to the input for label association. */
  id?: string;
};

type UncontrolledProps = CommonProps & {
  /** Form field name — the value submits as YYYY-MM-DD. */
  name: string;
  defaultValue?: string;
  value?: undefined;
  onChange?: undefined;
};

type ControlledProps = CommonProps & {
  name?: string;
  value: string;
  onChange: (next: string) => void;
  defaultValue?: undefined;
};

type Props = UncontrolledProps | ControlledProps;

/**
 * Native `<input type="date">` paired with the branded DatePickerPopover.
 * The browser's built-in calendar indicator is hidden; clicking the
 * external calendar icon opens the styled DayPicker popover instead.
 *
 * The native input still handles typing and form submission via its
 * `name` attribute — DateInputWithPicker is a drop-in replacement for
 * `<Input type="date" name="..." defaultValue="..." />` in FormData-based
 * forms. Inline-editable date fields keep using EditableField (which
 * already embeds DatePickerPopover internally).
 */
export function DateInputWithPicker(props: Props) {
  const { disabled, pickerLabel, className, id } = props;
  const tc = useTranslations('common');

  // Uncontrolled = manages its own state from defaultValue.
  // Controlled = parent owns value via `value` + `onChange`.
  const isControlled = props.value !== undefined;
  const [innerValue, setInnerValue] = useState(
    isControlled ? '' : (props.defaultValue ?? ''),
  );
  const value = isControlled ? props.value : innerValue;
  const setValue = (next: string): void => {
    if (isControlled) {
      props.onChange(next);
    } else {
      setInnerValue(next);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        id={id}
        name={props.name}
        type="date"
        value={value}
        dir="ltr"
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        className={`[&::-webkit-calendar-picker-indicator]:hidden ${className ?? ''}`}
      />
      <DatePickerPopover
        value={value || null}
        onSelect={(next) => setValue(next ?? '')}
        label={pickerLabel ?? tc('selectDate')}
        disabled={disabled}
      />
    </div>
  );
}
