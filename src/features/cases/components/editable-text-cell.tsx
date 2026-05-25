'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, Loader2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

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
  const tFields = useTranslations('case.fields');
  const effectivePlaceholder = placeholder ?? tc('noteHint');
  const fieldLabel = field === 'short_note' ? tFields('shortNote') : tFields('referrer');
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
    // Guard against double-save (outside-click + button-click can both fire)
    if (isPending) return;
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
        toast.error(tc('saveFailed'));
      }
    });
  };

  const cancel = () => {
    setValue(savedValue);
    setEditing(false);
  };

  const displayValue = savedValue || emptyLabel;
  const isEmpty = !savedValue;

  const triggerLabel = savedValue ? `${fieldLabel}: ${savedValue}` : fieldLabel;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={openEditor}
        aria-label={triggerLabel}
        className="group inline-flex items-center gap-1.5 w-full text-start min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
      >
        <span
          aria-hidden="true"
          className={[
            'truncate text-sm min-w-0 flex-1',
            isEmpty ? 'text-neutral-500 italic' : 'text-neutral-700',
          ].join(' ')}
        >
          {displayValue}
        </span>
        {isPending ? (
          <Loader2 className="size-3 text-brand-gold-text animate-spin shrink-0" aria-hidden="true" />
        ) : showSaved ? (
          <Check className="size-3 text-emerald-600 shrink-0" aria-hidden="true" />
        ) : (
          <Pencil
            aria-hidden="true"
            className="size-3 text-neutral-500 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition shrink-0"
          />
        )}
      </button>

      {editing && popoverPos && (
        <>
          {/* Exit saves: clicking outside commits the note (same as the Save
              button / Ctrl+Enter). save() is a no-op when nothing changed, so
              an accidental click can't blank a note. Esc / Cancel still discard. */}
          <div className="fixed inset-0 z-40" onClick={save} aria-hidden="true" />
          <div
            role="dialog"
            aria-label={fieldLabel}
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
              aria-label={fieldLabel}
              placeholder={effectivePlaceholder}
              className="w-full px-2 py-1.5 text-sm border border-neutral-200 rounded resize-none focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
            />
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <span className="text-[10px] text-neutral-600">
                Ctrl+Enter {tc('save')} · Esc {tc('cancel')}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={cancel}
                  className="text-xs text-neutral-700 px-2.5 py-1 rounded hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
                >
                  {tc('cancel')}
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="text-xs bg-brand-black text-white px-2.5 py-1 rounded hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text"
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
