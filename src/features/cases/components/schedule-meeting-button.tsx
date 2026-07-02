'use client';

import { useState } from 'react';

import { Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';

import { buildGoogleCalendarEventUrl } from '../domain/google-calendar-link';

const DURATIONS = [30, 60, 90, 120] as const;

type Props = {
  /** Tooltip for the action-bar button. */
  title: string;
  /** Used to pre-fill the event title (client name or case number). */
  clientLabel: string;
};

export function ScheduleMeetingButton({ title, clientLabel }: Props) {
  const t = useTranslations('case.scheduleMeeting');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const openDialog = () => {
    setEventTitle(t('eventTitle', { client: clientLabel }));
    setDate('');
    setTime('');
    setDuration(60);
    setLocation('');
    setNotes('');
    setOpen(true);
  };

  const canSubmit = date !== '' && time !== '';

  const submit = () => {
    const start = new Date(`${date}T${time}`);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + duration * 60_000);
    const url = buildGoogleCalendarEventUrl({
      title: eventTitle,
      start,
      end,
      details: notes || undefined,
      location: location || undefined,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  return (
    <>
      <Tooltip content={title}>
        <button
          type="button"
          aria-label={title}
          onClick={openDialog}
          className="tap-target relative flex size-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-white hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
        >
          <Calendar className="size-3.5" aria-hidden="true" />
        </button>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('dialogTitle')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-3"
          >
            <Field label={t('fields.title')}>
              <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Field label={t('fields.date')} className="flex-1">
                <DateInputWithPicker
                  value={date}
                  onChange={setDate}
                  pickerLabel={t('fields.date')}
                />
              </Field>
              <Field label={t('fields.time')} className="flex-1">
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            </div>
            <Field label={t('fields.duration')}>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-neutral-200 px-2 text-sm focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
              >
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {t('minutes', { count: m })}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('fields.location')}>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>
            <Field label={t('fields.notes')}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-md border border-neutral-200 px-2 py-1.5 text-sm focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
              />
            </Field>
            <DialogFooter>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-brand-gold font-semibold text-brand-black hover:bg-brand-gold-hover"
              >
                {t('open')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc('cancel')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  // <label> wraps the control directly, so no `htmlFor` is needed — the implicit
  // association still works for screen readers and click-to-focus.
  return (
    <label className={['block', className].filter(Boolean).join(' ')}>
      <span className="mb-1 block text-xs text-neutral-600">{label}</span>
      {children}
    </label>
  );
}
