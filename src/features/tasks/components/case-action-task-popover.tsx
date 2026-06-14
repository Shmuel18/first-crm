'use client';

import { useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import { ArrowUpRight, Plus, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Tooltip } from '@/components/ui/tooltip';
import type { Locale } from '@/lib/i18n/direction';

import { TaskFormDialog } from './task-form-dialog';
import { TasksList } from './tasks-list';
import { isImmediateTask } from '../domain/task-state';
import type { TaskWithRelations } from '../types';

type Profile = { id: string; first_name: string | null; last_name: string | null };
type CaseOption = { id: string; case_number: string; label: string };

type Props = {
  caseId: string;
  caseNumber: string;
  tasks: ReadonlyArray<TaskWithRelations>;
  assignees: ReadonlyArray<Profile>;
  caseOption: CaseOption | null;
  locale: Locale;
  /** Tooltip / aria-label for the trigger button. */
  title: string;
};

/**
 * Popover entry point for case tasks. Replaces the previous icon-only
 * "create task" button: clicking the trigger opens a panel anchored to
 * the button with the case's open tasks, a "+ new task" CTA, and a link
 * to the full /tasks view. The "Open Tasks" section that used to live
 * inside the admin block was removed in favour of this popover so tasks
 * have a single, discoverable entry point at the top of the page.
 *
 * The create dialog is rendered out-of-tree (Radix portal). To avoid the
 * outside-click handler closing the popover behind the dialog, opening
 * the dialog explicitly closes the popover first.
 */
export function CaseActionTaskPopover({
  caseId,
  caseNumber,
  tasks,
  assignees,
  caseOption,
  locale,
  title,
}: Props) {
  const t = useTranslations('tasks');
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside the trigger + panel. Skipped while the create
  // dialog is open so clicks inside the portal don't close us.
  useEffect(() => {
    if (!open || dialogOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target) ||
        // The rows render their ⋯ menu and its edit / reassign / thread
        // dialogs + delete-confirm into a Base UI portal at <body>, so those
        // clicks land OUTSIDE panelRef. Treating them as "outside" would close
        // the popover and unmount the row mid-action — e.g. clicking "delete"
        // closed the popover before the confirm dialog could even appear, so
        // nothing happened. Keep the popover open while interacting with them.
        target?.closest('[role="menu"]') ||
        target?.closest('[role="dialog"]') ||
        target?.closest('[role="alertdialog"]')
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, dialogOpen]);

  const cases = caseOption ? [caseOption] : [
    { id: caseId, case_number: caseNumber, label: `#${caseNumber}` },
  ];
  const immediateCount = tasks.filter(isImmediateTask).length;

  return (
    <div className="relative">
      <Tooltip content={title}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={title}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="relative size-8 rounded-md text-neutral-600 hover:bg-white hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50 transition flex items-center justify-center"
        >
          <UserPlus className="size-3.5" aria-hidden="true" />
          {tasks.length > 0 && (
            <span
              aria-hidden="true"
              className={[
                'absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold inline-flex items-center justify-center',
                immediateCount > 0
                  ? 'task-critical-dot bg-red-600 text-white'
                  : 'bg-brand-gold-text text-white',
              ].join(' ')}
            >
              {immediateCount > 0 ? immediateCount : tasks.length}
            </span>
          )}
        </button>
      </Tooltip>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('title')}
          className="absolute end-0 top-full mt-2 w-[min(28rem,calc(100vw-2rem))] bg-white rounded-xl shadow-2xl border border-neutral-200 z-50 overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-neutral-100 bg-neutral-50/60">
            <h3 className="text-sm font-semibold text-neutral-900 min-w-0">
              {t('openTitle')}{' '}
              <span className="text-neutral-500 font-normal">({tasks.length})</span>
            </h3>
            {immediateCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                <span className="task-critical-dot size-1.5 rounded-full bg-red-600" />
                {t('immediateCount', { count: immediateCount })}
              </span>
            )}
            <Link
              href={`/tasks?view=all&case=${caseId}`}
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-xs text-brand-gold-text hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
            >
              {t('openFull')}
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
          </div>

          <div className="max-h-[26rem] overflow-y-auto p-3">
            <TasksList
              tasks={tasks}
              assignees={assignees}
              cases={cases}
              locale={locale}
              presetCaseId={caseId}
              emptyKey="emptyCase"
              compact
              hideCreateButton
            />
          </div>

          <div className="px-3 py-2.5 border-t border-neutral-100 bg-neutral-50/60">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDialogOpen(true);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-gold hover:bg-brand-gold-hover text-brand-black text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {t('newTask')}
            </button>
          </div>
        </div>
      )}

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="create"
        presetCaseId={caseId}
        assignees={assignees}
        cases={cases}
      />
    </div>
  );
}
