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

const POPOVER_WIDTH = 320;

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
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      });
    }
  }, [editing]);

  useEffect(() => {
    if (!showSaved) return;
    const t = setTimeout(() => setShowSaved(false), 1500);
    return () => clearTimeout(t);
  }, [showSaved]);

  const openEditor = () => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (r) {
      // Anchor below the cell, right-aligned to cell's end (so it doesn't overflow the table)
      const left = Math.max(8, Math.min(r.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 8));
      const top = r.bottom + 4;
      setPopoverPos({ top, left });
    }
    setValue(savedValue);
    setEditing(true);
  };

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
        setSavedValue(previousSaved);
        setValue(previousSaved);
      }
    });
  };

  const cancel = () => {
    setValue(savedValue);
    setEditing(false);
  };

  const displayValue = savedValue || emptyLabel;
  const isEmpty = !savedValue;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={openEditor}
        title={savedValue || effectivePlaceholder}
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

      {editing && popoverPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={cancel} />
          <div
            className="fixed z-50 bg-white shadow-2xl border border-neutral-200 rounded-lg p-2"
            style={{ top: popoverPos.top, left: popoverPos.left, width: POPOVER_WIDTH }}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
                if (e.key === 'Escape') cancel();
              }}
              rows={4}
              placeholder={effectivePlaceholder}
              className="w-full px-2 py-1.5 text-sm border border-neutral-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-[#C9A961]/40"
            />
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <span className="text-[10px] text-neutral-400">⌘↵ {tc('save')} · Esc {tc('cancel')}</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={cancel}
                  className="text-xs text-neutral-600 px-2.5 py-1 rounded hover:bg-neutral-100"
                >
                  {tc('cancel')}
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="text-xs bg-[#0A0A0A] text-white px-2.5 py-1 rounded hover:bg-neutral-800"
                >
                  {tc('save')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
