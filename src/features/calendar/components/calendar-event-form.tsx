'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { callAction } from '@/lib/actions/call-action';

import { saveCalendarEventAction } from '../actions/save-calendar-event';
import { isEventKind } from '../domain/event-kind';
import { israelDayAndTime } from '../domain/israel-day';
import { EVENT_KINDS, type CalendarEventRecord, type EventKind } from '../types';

import type { AdvisorChoice } from './calendar-filters';

export type CaseChoice = { id: string; label: string };

type Props = {
  /** Existing event to edit, or the new event's preset day / time. */
  initial: CalendarEventRecord | { day: string; time: string | null };
  onClose: () => void;
  onSaved: () => void;
  currentUserId: string;
  /** manage_team_calendar: may put other staff on the event. */
  canManageTeam: boolean;
  staff: ReadonlyArray<AdvisorChoice>;
  cases: ReadonlyArray<CaseChoice>;
};

const REMINDERS = ['', '60', '1440'] as const;

/** Add / edit a calendar event (meeting, signing, reminder…). */
export function CalendarEventForm({ initial, onClose, onSaved, currentUserId, canManageTeam, staff, cases }: Props) {
  const t = useTranslations('calendar.form');
  const tc = useTranslations('common');
  const existing = 'id' in initial ? initial : null;
  const start = existing ? israelDayAndTime(existing.startsAt) : null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [kind, setKind] = useState<EventKind>(existing?.kind ?? 'client_meeting');
  const [date, setDate] = useState(start?.day ?? ('day' in initial ? initial.day : ''));
  const [allDay, setAllDay] = useState(existing ? existing.allDay : !('time' in initial && initial.time));
  const [startTime, setStartTime] = useState(start?.time ?? ('time' in initial ? (initial.time ?? '09:00') : '09:00'));
  const [endTime, setEndTime] = useState(existing?.endsAt ? israelDayAndTime(existing.endsAt).time : '');
  const [endDate, setEndDate] = useState(existing?.allDay && existing.endsAt ? israelDayAndTime(existing.endsAt).day : '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [caseId, setCaseId] = useState(existing?.caseId ?? '');
  const [reminder, setReminder] = useState(existing?.reminderMinutes ? String(existing.reminderMinutes) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [participants, setParticipants] = useState<string[]>(existing?.participantIds ?? [currentUserId]);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string): void =>
    setParticipants((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const save = (): void => {
    startTransition(async () => {
      const res = await callAction(() =>
        saveCalendarEventAction({
          id: existing?.id ?? null,
          title,
          kind,
          date,
          startTime: allDay ? null : startTime,
          endTime: allDay || !endTime ? null : endTime,
          endDate: allDay && endDate > date ? endDate : null,
          location: location.trim() || null,
          notes: notes.trim() || null,
          caseId: caseId || null,
          reminderMinutes: reminder ? Number(reminder) : null,
          participantIds: canManageTeam ? participants : [currentUserId],
        }),
      );
      if (res.ok) {
        toast.success(t('saved'));
        onSaved();
      } else {
        toast.error(t(res.error === 'validation' ? 'invalid' : res.error === 'unauthorized' ? 'unauthorized' : 'failed'));
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? t('editTitle') : t('newTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FormField label={t('title')} required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('kind')}>
              <NativeSelect
                value={kind}
                onChange={(e) => {
                  if (!isEventKind(e.target.value)) return;
                  setKind(e.target.value);
                  // A vacation / trip abroad is whole days.
                  if (e.target.value === 'absence') setAllDay(true);
                }}
              >
                {EVENT_KINDS.map((k) => (
                  <option key={k} value={k}>{t(`kinds.${k}`)}</option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('date')} required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            {t('allDay')}
          </label>
          {allDay && (
            <FormField label={t('endDate')}>
              <Input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
          )}
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('start')}>
                <Input type="time" dir="ltr" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </FormField>
              <FormField label={t('end')}>
                <Input type="time" dir="ltr" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </FormField>
            </div>
          )}
          <FormField label={t('location')}>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('case')}>
              <NativeSelect value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                <option value="">{t('noCase')}</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('reminder')}>
              <NativeSelect value={reminder} onChange={(e) => setReminder(e.target.value)}>
                {REMINDERS.map((r) => (
                  <option key={r} value={r}>{t(`reminders.${r || 'none'}`)}</option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          {canManageTeam && staff.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-neutral-600">{t('participants')}</legend>
              <div className="flex max-h-28 flex-wrap gap-x-4 gap-y-1 overflow-y-auto">
                {staff.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-xs text-neutral-700">
                    <input type="checkbox" checked={participants.includes(s.id)} onChange={() => toggle(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <FormField label={t('notes')}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} />
          </FormField>
        </div>
        <DialogFooter>
          <Button type="button" onClick={save} disabled={isPending || !title.trim() || !date}>
            {tc('save')}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
