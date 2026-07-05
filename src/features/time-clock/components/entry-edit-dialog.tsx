'use client';

import { useState, useTransition } from 'react';

import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { deleteEntryAction } from '../actions/delete-entry';
import { upsertEntryAction } from '../actions/upsert-entry';
import type { TimeEntry } from '../types';

/** ISO instant → a `datetime-local` value in the browser's zone (Israel for the manager). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** `datetime-local` value (browser zone) → ISO, or null. */
function inputToIso(local: string): string | null {
  if (!local) return null;
  const ms = Date.parse(local);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The entry to edit, or null to create a new one. */
  entry: TimeEntry | null;
  userId: string;
  employeeName: string;
  onSaved: () => void;
};

const inputClass =
  'w-full h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:border-brand-gold-text focus:outline-none focus:ring-2 focus:ring-brand-gold-text/30';

export function EntryEditDialog({ open, onOpenChange, entry, userId, employeeName, onSaved }: Props) {
  const t = useTranslations('timeClock');
  const [pending, start] = useTransition();
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [note, setNote] = useState('');

  // Re-seed the controlled fields each time the dialog opens for a (possibly
  // different) entry — a reused dialog otherwise keeps the previous values.
  const key = `${open ? 1 : 0}:${entry?.id ?? 'new'}`;
  const [seed, setSeed] = useState<string | null>(null);
  if (open && seed !== key) {
    setSeed(key);
    setClockIn(toLocalInput(entry ? entry.clockIn : new Date().toISOString()));
    setClockOut(entry?.clockOut ? toLocalInput(entry.clockOut) : '');
    setNote(entry?.note ?? '');
  }
  if (!open && seed !== null) setSeed(null);

  const save = () => {
    const inIso = inputToIso(clockIn);
    if (!inIso) {
      toast.error(t('errors.validation'));
      return;
    }
    const outIso = clockOut ? inputToIso(clockOut) : null;
    if (outIso && Date.parse(outIso) < Date.parse(inIso)) {
      toast.error(t('manager.outBeforeIn'));
      return;
    }
    start(async () => {
      const res = await upsertEntryAction({
        id: entry?.id ?? null,
        userId,
        clockIn: inIso,
        clockOut: outIso,
        note: note.trim() || null,
      });
      if (!res.ok) {
        toast.error(t(`errors.${res.error}`));
        return;
      }
      toast.success(t('manager.saved'));
      onOpenChange(false);
      onSaved();
    });
  };

  const remove = () => {
    if (!entry) return;
    start(async () => {
      const res = await deleteEntryAction(entry.id);
      if (!res.ok) {
        toast.error(t(`errors.${res.error}`));
        return;
      }
      toast.success(t('manager.deleted'));
      onOpenChange(false);
      onSaved();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? t('manager.editEntry') : t('manager.newEntry', { name: employeeName })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t('manager.clockIn')}</span>
            <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className={inputClass} dir="ltr" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t('manager.clockOut')}</span>
            <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className={inputClass} dir="ltr" />
            <span className="mt-1 block text-xs text-neutral-400">{t('manager.clockOutHint')}</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t('manager.note')}</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} maxLength={500} />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          {entry ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t('manager.delete')}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-black px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {t('manager.save')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
