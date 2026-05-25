'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import {
  AlertCircle,
  DatabaseBackup,
  ExternalLink,
  FileJson,
  Loader2,
  Plug,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { runBackupAction } from '../actions/run-backup';
import type { BackupView } from '../types';

import { BackupRestoreButton } from './backup-restore-button';

type Props = { view: BackupView };

export function BackupPanel({ view }: Props) {
  const t = useTranslations('settings.backup');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const dateLocale = locale === 'he' ? 'he-IL' : 'en-GB';
  const fmtDate = (iso: string) => new Date(iso).toLocaleString(dateLocale);
  const lastBackup = view.backups[0] ?? null;

  const runBackup = () =>
    startTransition(async () => {
      const res = await runBackupAction();
      if (res.ok) {
        toast.success(t('toast.done', { count: res.totalRows }));
        router.refresh();
      } else if (res.error === 'not_connected') {
        toast.error(t('toast.notConnected'));
      } else if (res.error === 'rate_limited') {
        toast.error(t('toast.rateLimited'));
      } else {
        toast.error(t('toast.failed'));
      }
    });

  if (!view.oauthConfigured) {
    return <Notice icon={AlertCircle} title={t('notConfiguredTitle')} body={t('notConfiguredBody')} />;
  }

  if (!view.driveConnected) {
    return (
      <div className="space-y-4">
        <Notice icon={Plug} title={t('notConnectedTitle')} body={t('notConnectedBody')} />
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-[#C9A961] hover:bg-[#B8985A] text-[#0A0A0A] font-medium text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]"
        >
          <Plug className="size-4" aria-hidden="true" />
          {t('goToIntegrations')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#C9A961]/30 bg-[#FAF8F3] p-5">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="size-12 rounded-xl bg-[#0A0A0A] text-[#C9A961] flex items-center justify-center shrink-0"
          >
            <DatabaseBackup className="size-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-neutral-800">{t('dataNote')}</p>
            <p className="text-xs text-neutral-600 mt-1">
              {lastBackup
                ? t('lastBackup', { date: fmtDate(lastBackup.createdTime) })
                : t('never')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={runBackup}
          disabled={pending}
          aria-busy={pending}
          className="mt-4 inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-[#C9A961] hover:bg-[#B8985A] disabled:opacity-60 text-[#0A0A0A] font-medium text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <DatabaseBackup className="size-4" aria-hidden="true" />
          )}
          {pending ? t('backingUp') : t('backupNow')}
        </button>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-2">
          {t('recent')}
        </h3>
        {view.backups.length === 0 ? (
          <p className="text-sm text-neutral-600 py-4">{t('never')}</p>
        ) : (
          <ul className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
            {view.backups.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50/60"
              >
                <FileJson className="size-4 text-[#A88840] shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-neutral-800 truncate">{b.name}</p>
                  <p className="text-xs text-neutral-600">
                    {fmtDate(b.createdTime)}
                    {b.size != null && ` · ${formatSize(b.size)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <BackupRestoreButton fileId={b.id} fileName={b.name} />
                  <a
                    href={b.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-neutral-700 hover:text-[#A88840] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40 rounded transition"
                  >
                    {t('open')}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Notice({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <Icon className="size-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900">{title}</p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}
