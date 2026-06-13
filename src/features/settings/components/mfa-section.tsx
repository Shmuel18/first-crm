'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { enrollMfaAction, verifyMfaEnrollmentAction } from '../actions/mfa';
import { disableMfaAction, getMfaStatusAction } from '../actions/mfa-manage';

type EnrollState = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function MfaSection() {
  const t = useTranslations('settings.security.mfa');
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ enrolled: boolean; factorId: string | null } | null>(null);
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus(): Promise<void> {
    const res = await getMfaStatusAction();
    if (res.ok) setStatus({ enrolled: res.enrolled, factorId: res.factorId });
  }

  function handleStartEnroll(): void {
    startTransition(async () => {
      const res = await enrollMfaAction();
      if (!res.ok) {
        toast.error(res.error === 'already_enrolled' ? t('errors.alreadyEnrolled') : t('errors.generic'));
        return;
      }
      setEnroll({ factorId: res.factorId, qrCode: res.qrCode, secret: res.secret });
      setCode('');
      setCodeError(null);
    });
  }

  function handleVerify(): void {
    if (!enroll) return;
    setCodeError(null);
    startTransition(async () => {
      const res = await verifyMfaEnrollmentAction(enroll.factorId, code);
      if (!res.ok) {
        setCodeError(res.error === 'invalid_code' ? t('errors.invalidCode') : t('errors.generic'));
        return;
      }
      toast.success(t('enabled'));
      setEnroll(null);
      setCode('');
      await refreshStatus();
    });
  }

  function handleDisable(): void {
    if (!status?.factorId) return;
    if (!confirm(t('confirmDisable'))) return;
    startTransition(async () => {
      const res = await disableMfaAction(status.factorId!);
      if (!res.ok) {
        toast.error(t('errors.generic'));
        return;
      }
      toast.success(t('disabled'));
      await refreshStatus();
    });
  }

  if (status === null) {
    // Initial load — render a stable shell so the section height doesn't jump.
    return (
      <section>
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">{t('title')}</h3>
        <p className="text-sm text-neutral-500 mb-3">{t('hint')}</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-neutral-900 mb-1">{t('title')}</h3>
      <p className="text-sm text-neutral-500 mb-3">{t('hint')}</p>

      {status.enrolled ? (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {t('statusEnabled')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDisable}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <ShieldOff className="size-4 me-1.5" />
                {t('disable')}
              </>
            )}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          onClick={handleStartEnroll}
          disabled={pending}
          className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold h-11"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="size-4 me-1.5" />
              {t('enable')}
            </>
          )}
        </Button>
      )}

      <Dialog open={enroll !== null} onOpenChange={(open) => !open && setEnroll(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dialog.title')}</DialogTitle>
            <DialogDescription>{t('dialog.subtitle')}</DialogDescription>
          </DialogHeader>

          {enroll && (
            <div className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-700">
                <li>{t('dialog.step1')}</li>
                <li>{t('dialog.step2')}</li>
                <li>{t('dialog.step3')}</li>
              </ol>

              <div className="flex justify-center bg-white p-3 border border-neutral-200 rounded-lg">
                {/* Supabase returns the QR as an SVG data URI. next/image
                    needs explicit dimensions for unoptimized data URLs. */}
                <Image
                  src={enroll.qrCode}
                  alt={t('dialog.qrAlt')}
                  width={200}
                  height={200}
                  unoptimized
                />
              </div>

              <div>
                <p className="text-xs text-neutral-500 mb-1">{t('dialog.secretLabel')}</p>
                <code
                  className="block w-full text-xs font-mono bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 select-all break-all"
                  dir="ltr"
                >
                  {enroll.secret}
                </code>
              </div>

              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium mb-1">
                  {t('dialog.codeLabel')}
                </label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center font-mono tracking-[0.5em] text-lg"
                />
                {codeError && (
                  <p className="text-xs text-red-600 mt-1">{codeError}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t('dialog.cancel')}
            </DialogClose>
            <Button
              type="button"
              onClick={handleVerify}
              disabled={pending || code.length !== 6}
              className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : t('dialog.verify')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
