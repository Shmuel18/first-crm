'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, Loader2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { quickUpdateCaseFieldAction } from '../actions/quick-update-case';

type EditableTextCellProps = {
  caseId: string;
  field: 'short_note' | 'referrer_name';
  initialValue: string | null;
  placeholder?: string;
  emptyLabel?: string;
};

export function EditableTextCell({
  caseId,
  field,
  initialValue,
  placeholder,
  emptyLabel = '—',
}: EditableTextCellProps) {
  const tc = useTranslations('common');
  const effectivePlaceholder = placeholder ?? tc('noteHint');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue ?? '');
  const [savedValue, setSavedValue] = useState(initialValue ?? '');
  const [isPending, startTransition] = useTransition();
  const [showSaved, setShowSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!showSaved) return;
    const t = setTimeout(() => setShowSaved(false), 1500);
    return () => clearTimeout(t);
  }, [showSaved]);

  const save = () => {
    if (value === savedValue) {
      setEditing(false);
      return;
    }
    const previousSaved = savedValue;
    const newValue = value;
    setSavedValue(newValue);
    setEditing(false);

    startTransition(async () => {
      const result = await quickUpdateCaseFieldAction(caseId, field, newValue || null);
      if (result.ok) {
        setShowSaved(true);
      } else {
        // Revert on failure
        setSavedValue(previousSaved);
        setValue(previousSaved);
      }
    });
  };

  const cancel = () => {
    setValue(savedValue);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') cancel();
        }}
        onBlur={save}
        placeholder={effectivePlaceholder}
        className="block w-full px-2 py-0.5 text-sm border border-[#C9A961] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#C9A961]/40"
      />
    );
  }

  const displayValue = savedValue || emptyLabel;
  const isEmpty = !savedValue;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-1.5 w-full text-right min-w-0"
    >
      <span
        className={[
          'truncate text-sm min-w-0 flex-1',
          isEmpty ? 'text-neutral-400 italic' : 'text-neutral-700',
        ].join(' ')}
      >
        {displayValue}
      </span>
      {isPending ? (
        <Loader2 className="size-3 text-[#C9A961] animate-spin shrink-0" />
      ) : showSaved ? (
        <Check className="size-3 text-emerald-500 shrink-0" />
      ) : (
        <Pencil className="size-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
      )}
    </button>
  );
}
