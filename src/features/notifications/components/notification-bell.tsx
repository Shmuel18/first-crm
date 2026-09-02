'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Bell, CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { requestTaskBadgeRefresh } from '@/features/tasks/hooks/use-live-task-badge';
import type { Locale } from '@/lib/i18n/direction';
import { createClient } from '@/lib/supabase/client';

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '../actions/mark-read';
import { refreshTaskSurfacesAction } from '../actions/refresh-task-surfaces';
import { formatRelativeTime } from '../domain/format';
import { notificationHref } from '../domain/notification-href';
import type {
  Notification,
  NotificationData,
  NotificationDataAiDigest,
  NotificationDataCaseMention,
  NotificationDataCaseStatusOverdue,
  NotificationDataTask,
  NotificationDataTaskMention,
  NotificationDataWebLead,
  NotificationType,
} from '../types';

type Props = {
  initialUnread: number;
  notifications: ReadonlyArray<Notification>;
  locale: Locale;
};

function isTaskNotification(type: NotificationType): boolean {
  return (
    type === 'task_assigned' ||
    type === 'task_completed' ||
    type === 'task_reminder' ||
    type === 'task_mention' ||
    type === 'task_comment'
  );
}

export function NotificationBell({ initialUnread, notifications, locale }: Props) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [items, setItems] = useState(notifications);
  const [unread, setUnread] = useState(initialUnread);

  // Relative timestamps ("a second ago") are computed during render, so without
  // a re-render they freeze — a realtime-arrived row would read "a second ago"
  // indefinitely until the next refresh/interaction. Tick every 30s so the
  // times stay accurate without a manual refresh (30s is plenty for the
  // minute/hour-scale relative formatting below).
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Realtime: a new notification for THIS user lands in the bell the instant
  // it's created — no navigation/refresh (migration 127 puts `notifications`
  // in the supabase_realtime publication). The bell lives in the persistent
  // (app) layout, so this subscription is created once and lives for the
  // session. RLS (user_id = auth.uid) + the explicit user_id filter mean we
  // only ever receive our own rows.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const requestTaskSurfacesRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        startTransition(() => {
          void refreshTaskSurfacesAction().catch(() => {
            router.refresh();
          });
        });
      }, 100);
    };

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`notifications:${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          (payload) => {
            // Realtime payloads are loosely typed; the new row is a
            // notifications Row — narrow type/data to the bell's union.
            const row = payload.new as Record<string, unknown>;
            const notif = {
              ...row,
              type: row.type as NotificationType,
              data: (row.data ?? {}) as NotificationData,
            } as Notification;
            // Dedupe: a later layout re-render may also bring this row in via
            // props (the reconcile effect resets to server state).
            setItems((prev) => (prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]));
            setUnread((u) => u + 1);
            // The bell is realtime, but the tasks LIST and the sidebar task
            // badge are server-rendered — refresh them so a newly-assigned task
            // shows in the list / badge live, not only after a manual refresh.
            // (The red state is derived from `items` below — hasUnreadCritical —
            // so it stays red as long as an unread critical task is present.)
            if (isTaskNotification(notif.type)) {
              requestTaskSurfacesRefresh();
              // The rail's badge is client-owned (TaskBadgeProvider) and does
              // NOT ride on the layout re-render above — poke it directly.
              requestTaskBadgeRefresh();
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, startTransition]);

  // The bell lives in the persistent (app) layout's Topbar, which isn't
  // remounted on navigation. Reconcile to fresh server props during render
  // (React's "adjust state on prop change" pattern) so new server
  // notifications appear; local optimistic updates still give instant feedback
  // between server renders. `notifications` is a fresh array each server render.
  const [syncedRef, setSyncedRef] = useState(notifications);
  if (syncedRef !== notifications) {
    setSyncedRef(notifications);
    setItems(notifications);
    setUnread(initialUnread);
  }

  const message = (n: Notification): string => {
    // Exhaustive switch on n.type — TS surfaces a missing branch when a
    // new NotificationType is added. The default arm is a defensive
    // fallback for stale rows (e.g., a type removed from the enum but
    // still in old DB rows) so the bell never crashes-renders.
    switch (n.type) {
      case 'case_status_overdue': {
        // Narrow to the case-overdue data shape. Old/corrupt rows might
        // lack some fields — fall back per-field to keep the message
        // human-readable instead of rendering empty quotes / zeros.
        const d = n.data as Partial<NotificationDataCaseStatusOverdue>;
        const statusName =
          (locale === 'he' ? d.statusNameHe : d.statusNameEn) ?? d.statusKey ?? t('unknownStatus');
        return t('message.case_status_overdue', {
          caseNumber: d.caseNumber ?? t('aCase'),
          statusName,
          days: d.daysInStatus ?? 0,
          threshold: d.threshold ?? 0,
        });
      }
      case 'task_assigned':
      case 'task_completed':
      case 'task_reminder': {
        const d = n.data as Partial<NotificationDataTask>;
        const actor = d.actorName || (n.actor_id ? t('someone') : t('system'));
        const task = d.taskTitle || t('aTask');
        if (n.type === 'task_reminder') {
          return t('message.task_reminder', { task });
        }
        if (n.type === 'task_assigned' && d.assignmentKind === 'returned_to_creator') {
          return t('message.task_returned_to_creator', { actor, task });
        }
        if (n.type === 'task_assigned' && d.assignmentKind === 'reassigned') {
          return t('message.task_reassigned_to_you', { actor, task });
        }
        if (n.type === 'task_assigned' && d.priority === 'critical') {
          return t('message.task_assigned_critical', { actor, task });
        }
        return t(`message.${n.type}`, { actor, task });
      }
      case 'case_mention': {
        const d = n.data as Partial<NotificationDataCaseMention>;
        const actor = d.actorName || (n.actor_id ? t('someone') : t('system'));
        return t('message.case_mention', { actor, preview: d.preview ?? '' });
      }
      case 'task_mention': {
        const d = n.data as Partial<NotificationDataTaskMention>;
        const actor = d.actorName || (n.actor_id ? t('someone') : t('system'));
        const task = d.taskTitle || t('aTask');
        const preview = [task, d.preview].filter(Boolean).join(': ');
        return t('message.case_mention', { actor, preview });
      }
      case 'task_comment': {
        const d = n.data as Partial<NotificationDataTaskMention>;
        const actor = d.actorName || (n.actor_id ? t('someone') : t('system'));
        const task = d.taskTitle || t('aTask');
        const preview = d.preview ?? '';
        return t('message.task_comment', { actor, task, preview });
      }
      case 'backup_stale':
        return t('message.backup_stale');
      case 'erasure_stale':
        return t('message.erasure_stale');
      case 'web_lead': {
        const d = n.data as Partial<NotificationDataWebLead>;
        return t('message.web_lead', { name: d.leadName?.trim() || t('aLead') });
      }
      case 'ai_digest': {
        // The digest text IS the message — AI-phrased (or the deterministic
        // fallback), snapshot in the row like every other bell kind.
        const d = n.data as Partial<NotificationDataAiDigest>;
        return d.digest?.trim() || t('message.ai_digest');
      }
      default: {
        // Exhaustiveness check — TS errors here when a new
        // NotificationType is added without a render branch.
        const _exhaustive: never = n.type;
        void _exhaustive;
        return t('message.unknown');
      }
    }
  };

  // Secondary line: WHICH client the notification is about ("#1042 · יעקב כהן"),
  // plus a snippet of the description on task rows — the message alone (actor +
  // task title + comment preview) doesn't identify the case. Every case-linked
  // kind snapshots `caseLabel` (mig 181 task_completed, mig 222 the rest); rows
  // created before that, and office tasks with no case, just collapse the line.
  const contextLine = (n: Notification): string | null => {
    // Read-only peek at two optional fields shared by the data shapes — the
    // union member doesn't matter here, missing fields are filtered out below.
    const d = n.data as Partial<NotificationDataTask>;
    const withDescription = n.type === 'task_completed' || n.type === 'task_assigned';
    const parts = [d.caseLabel, withDescription ? d.description : null].filter(
      (x): x is string => typeof x === 'string' && x.trim().length > 0,
    );
    return parts.length > 0 ? parts.join(' — ') : null;
  };

  const handleClick = (n: Notification) => {
    // Reading removes the notification from the bell entirely (not just the
    // highlight). Drop it locally for instant feedback; the server mark-read +
    // layout revalidate keep it gone on the next render.
    setItems((prev) => prev.filter((it) => it.id !== n.id));
    if (!n.read_at) {
      setUnread((u) => Math.max(0, u - 1));
      startTransition(() => {
        void markNotificationReadAction(n.id);
      });
    }
    // One routing rule shared with the push payload and the email mirrors
    // (notificationHref) — a task notification opens that task's conversation,
    // never the case, which the reader may not be allowed to see.
    router.push(notificationHref(n.type, { caseId: n.case_id, taskId: n.task_id }));
  };

  const handleMarkAll = () => {
    // Clear the bell — every shown notification is unread, so reading them all
    // empties the list.
    setItems([]);
    setUnread(0);
    startTransition(() => {
      void markAllNotificationsReadAction();
    });
  };

  const ariaLabel =
    unread > 0 ? `${t('title')} — ${t('unreadCount', { count: unread })}` : t('title');
  const tooltipLabel =
    unread > 0 ? `${t('title')} (${unread})` : t('title');

  // Persistent red: stay red (pulsing) as long as there's an UNREAD critical
  // task notification — an "immediate" task keeps shouting until it's read,
  // not just a brief pulse. Derived from items, so reading it clears the red.
  const hasUnreadCritical = items.some(
    (n) => n.type === 'task_assigned' && (n.data as Partial<NotificationDataTask>).priority === 'critical',
  );

  return (
    <DropdownMenu>
      <Tooltip content={tooltipLabel}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={ariaLabel}
              className={`relative size-10 rounded-lg border transition flex items-center justify-center text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black ${
                hasUnreadCritical
                  ? 'border-red-500 ring-2 ring-red-500 animate-pulse'
                  : 'border-brand-black-border hover:border-brand-gold hover:bg-brand-black-soft'
              }`}
            >
              <Bell className="size-4" aria-hidden="true" />
              {unread > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute -top-1 -end-1 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    hasUnreadCritical ? 'bg-red-600 text-white' : 'bg-brand-gold text-brand-black'
                  }`}
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          }
        />
      </Tooltip>

      <DropdownMenuContent align="end" className="w-80 max-h-[28rem] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-100 sticky top-0 bg-popover">
          <span className="inline-flex items-center gap-2 font-display text-sm font-medium text-neutral-900">
            {t('title')}
            {unread > 0 && (
              <span
                aria-label={t('unreadCount', { count: unread })}
                className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-gold text-brand-black text-[10px] font-bold tabular-nums"
              >
                {unread}
              </span>
            )}
          </span>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="inline-flex items-center gap-1 text-xs text-brand-gold-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              {t('markAllRead')}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <span
              aria-hidden="true"
              className="size-12 rounded-full bg-brand-gold/15 flex items-center justify-center mx-auto mb-3"
            >
              <Bell className="size-6 text-brand-gold-text" />
            </span>
            <p className="text-sm text-neutral-600">{t('empty')}</p>
          </div>
        ) : (
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  aria-label={`${t('unreadIndicator')} — ${message(n)}`}
                  className="w-full text-start px-3 py-2.5 border-b border-neutral-100 last:border-0 bg-brand-gold-soft hover:bg-neutral-50 focus-visible:outline-none focus-visible:bg-brand-gold-soft transition flex gap-2.5"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2 rounded-full bg-brand-gold-text shrink-0"
                  />
                  <span>
                    <span className="block text-sm text-neutral-800 leading-snug">
                      {message(n)}
                    </span>
                    {contextLine(n) && (
                      <span className="mt-0.5 block text-xs text-neutral-600 leading-snug line-clamp-2">
                        {contextLine(n)}
                      </span>
                    )}
                    <span className="block text-[11px] text-neutral-600 mt-0.5">
                      {formatRelativeTime(n.created_at, locale)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
