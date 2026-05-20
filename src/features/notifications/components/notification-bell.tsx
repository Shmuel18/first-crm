'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Bell, CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Locale } from '@/lib/i18n/direction';

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '../actions/mark-read';
import { formatRelativeTime } from '../domain/format';
import type { Notification } from '../types';

type Props = {
  initialUnread: number;
  notifications: ReadonlyArray<Notification>;
  locale: Locale;
};

export function NotificationBell({ initialUnread, notifications, locale }: Props) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [items, setItems] = useState(notifications);
  const [unread, setUnread] = useState(initialUnread);

  const message = (n: Notification): string => {
    const actor = n.data.actorName || t('someone');
    const task = n.data.taskTitle || t('aTask');
    return t(`message.${n.type}`, { actor, task });
  };

  const handleClick = (n: Notification) => {
    if (!n.read_at) {
      setItems((prev) =>
        prev.map((it) => (it.id === n.id ? { ...it, read_at: new Date().toISOString() } : it)),
      );
      setUnread((u) => Math.max(0, u - 1));
      startTransition(() => {
        void markNotificationReadAction(n.id);
      });
    }
    router.push(n.case_id ? `/cases/${n.case_id}` : '/tasks');
  };

  const handleMarkAll = () => {
    setItems((prev) => prev.map((it) => ({ ...it, read_at: it.read_at ?? new Date().toISOString() })));
    setUnread(0);
    startTransition(() => {
      void markAllNotificationsReadAction();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative size-10 rounded-lg border border-[#333] hover:border-[#C9A961] hover:bg-[#1A1A1A] transition flex items-center justify-center text-white"
        title={t('title')}
        aria-label={t('title')}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -end-1 min-w-4 h-4 px-1 rounded-full bg-[#C9A961] text-[#0A0A0A] text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-h-[28rem] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-100 sticky top-0 bg-popover">
          <span className="inline-flex items-center gap-2 font-display text-sm font-medium text-neutral-900">
            {t('title')}
            {unread > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#C9A961] text-[#0A0A0A] text-[10px] font-bold tabular-nums">
                {unread}
              </span>
            )}
          </span>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="inline-flex items-center gap-1 text-xs text-[#C9A961] hover:underline"
            >
              <CheckCheck className="size-3.5" />
              {t('markAllRead')}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <span className="size-12 rounded-full bg-[#C9A961]/10 flex items-center justify-center mx-auto mb-3">
              <Bell className="size-6 text-[#C9A961]" />
            </span>
            <p className="text-sm text-neutral-500">{t('empty')}</p>
          </div>
        ) : (
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={[
                    'w-full text-start px-3 py-2.5 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition flex gap-2.5',
                    n.read_at ? '' : 'bg-[#FAF8F3]',
                  ].join(' ')}
                >
                  {!n.read_at && (
                    <span className="mt-1.5 size-2 rounded-full bg-[#C9A961] shrink-0" />
                  )}
                  <span className={n.read_at ? 'ps-4.5' : ''}>
                    <span className="block text-sm text-neutral-800 leading-snug">{message(n)}</span>
                    <span className="block text-[11px] text-neutral-400 mt-0.5">
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
