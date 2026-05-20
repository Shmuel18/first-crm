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
import { Input } from '@/components/ui/input';

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
      <button
        type="button"
        title={title}
        onClick={openDialog}
        className="relative flex size-8 items-center justify-center rounded-md text-neutral-500 transition hover:bg-white hover:text-[#C9A961]"
      >
        <Calendar className="size-3.5" />
      </button>

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
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label={t('fields.time')} className="flex-1">
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            </div>
            <Field label={t('fields.duration')}>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A961]/40"
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
                className="w-full resize-none rounded-md border border-neutral-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A961]/40"
              />
            </Field>
            <DialogFooter>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-[#C9A961] font-semibold text-[#0A0A0A] hover:bg-[#E8D5A2]"
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
  return (
    <label className={['block', className].filter(Boolean).join(' ')}>
      <span className="mb-1 block text-xs text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
