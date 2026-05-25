'use client';

import { useState, useTransition } from 'react';

import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Link2,
  Link2Off,
  Loader2,
  Settings2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import { disconnectGoogleDriveAction } from '../actions/disconnect-google-drive';
import type { DriveIntegrationView } from '../types';

type Props = {
  view: DriveIntegrationView;
  oauthConfigured: boolean;
  errorReason?: string | null;
  connectedFlag?: boolean;
};

export function DriveIntegrationCard({
  view,
  oauthConfigured,
  errorReason,
  connectedFlag,
}: Props) {
  const t = useTranslations('settings.integrations.drive');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const dateLocale = locale === 'he' ? 'he-IL' : 'en-GB';
  const connectedAt = view.connectedAt
    ? new Date(view.connectedAt).toLocaleString(dateLocale)
    : null;

  const handleDisconnectConfirmed = () =>
    startTransition(async () => {
      setConfirmOpen(false);
      await disconnectGoogleDriveAction();
    });

  const isConnected = view.status === 'connected';

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <header className="px-5 py-4 bg-gradient-to-b from-neutral-50 to-white border-b border-neutral-100">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <Cloud className="size-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-semibold text-neutral-900">
              {t('title')}
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">{t('subtitle')}</p>
          </div>
          <StatusBadge status={view.status} />
        </div>
      </header>

      <div className="px-5 py-5 space-y-4">
        {connectedFlag && (
          <Banner intent="success" message={t('connectedFlash')} icon={CheckCircle2} />
        )}
        {errorReason && (
          <Banner intent="error" message={prettifyError(errorReason, t)} icon={AlertCircle} />
        )}

        {!oauthConfigured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Settings2 className="size-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">{t('notConfiguredTitle')}</p>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  {t('notConfiguredBody')}
                </p>
              </div>
            </div>
          </div>
        )}

        {oauthConfigured && isConnected && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-neutral-700">{t('connectedAs')}</dt>
            <dd className="font-medium text-neutral-900 text-end">{view.connectedEmail}</dd>

            {connectedAt && (
              <>
                <dt className="text-neutral-700">{t('connectedAt')}</dt>
                <dd className="text-neutral-700 text-end">{connectedAt}</dd>
              </>
            )}

            <dt className="text-neutral-700">{t('rootFolder')}</dt>
            <dd className="text-neutral-700 text-end font-mono">{view.rootFolderName}/</dd>
          </dl>
        )}

        {oauthConfigured && !isConnected && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 leading-relaxed">
            {t('connectIntro')}
          </div>
        )}

        <div className="pt-2 flex flex-wrap gap-2">
          {oauthConfigured && !isConnected && (
            <a
              href="/api/auth/google/start"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-dark text-brand-black font-medium text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text focus-visible:ring-offset-2"
            >
              <Link2 className="size-4" aria-hidden="true" />
              {t('connect')}
            </a>
          )}
          {oauthConfigured && isConnected && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
              className="h-10"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2Off className="size-4 me-1" />}
              {t('disconnect')}
            </Button>
          )}
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogTitle>{t('disconnect')}</AlertDialogTitle>
            <AlertDialogDescription>{t('disconnectConfirm')}</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel
                render={
                  <Button type="button" variant="ghost" className="h-10">
                    {tCommon('cancel')}
                  </Button>
                }
              />
              <AlertDialogAction
                render={
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDisconnectConfirmed}
                    disabled={isPending}
                    className="h-10"
                  >
                    {t('disconnect')}
                  </Button>
                }
              />
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {oauthConfigured && (
          <p className="text-[11px] text-neutral-600 leading-relaxed pt-2 border-t border-neutral-100">
            {t('scopeNote')}
          </p>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: DriveIntegrationView['status'] }) {
  const t = useTranslations('settings.integrations.status');
  const tone =
    status === 'connected'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'error'
        ? 'bg-rose-100 text-rose-800'
        : 'bg-neutral-100 text-neutral-700';
  return (
    <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${tone}`}>
      {t(status)}
    </span>
  );
}

function Banner({
  intent,
  message,
  icon: Icon,
}: {
  intent: 'success' | 'error';
  message: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const tone =
    intent === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-rose-200 bg-rose-50 text-rose-800';
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${tone}`}>
      <Icon className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function prettifyError(
  reason: string,
  t: ReturnType<typeof useTranslations>,
): string {
  const known = [
    'oauth_not_configured',
    'state_mismatch',
    'admin_only',
    'missing_params',
    'access_denied',
    'drive_scope_missing',
  ];
  if (known.includes(reason)) return t(`errors.${reason}`);
  return t('errors.generic');
}
