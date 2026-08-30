'use client';

import { useState } from 'react';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { callAction } from '@/lib/actions/call-action';

import { submitAgreementSignatureAction } from '../actions/submit-agreement-signature';
import { SignaturePad } from './signature-pad';

import type { AgreementSection } from '../domain/agreement-text';

type Props = {
  token: string;
  title: string;
  officeName: string;
  /** "בין ... לבין ..." party lines, already composed server-side. */
  partyLines: string[];
  sections: AgreementSection[];
  /** 'ready' | 'signed' (already) | 'expired' — the page resolves this. */
  initialState: 'ready' | 'signed' | 'expired';
};

/**
 * The client-facing signing surface: the agreement text (server-built, same
 * source as the PDF), a consent checkbox, the signature pad, and submit.
 * Hebrew legal document → the container is explicitly RTL regardless of the
 * visitor's locale cookie.
 */
export function SignAgreementView({
  token,
  title,
  officeName,
  partyLines,
  sections,
  initialState,
}: Props) {
  const t = useTranslations('agreements.sign');
  const [signature, setSignature] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<'ready' | 'signed' | 'expired'>(initialState);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (!signature || !consent || pending) return;
    setPending(true);
    setError(null);
    const res = await callAction(() =>
      submitAgreementSignatureAction({ token, signaturePng: signature }),
    );
    setPending(false);
    if (res.ok) {
      setState('signed');
      return;
    }
    if (res.error === 'already_signed') {
      setState('signed');
      return;
    }
    if (res.error === 'expired') {
      setState('expired');
      return;
    }
    setError(t(`errors.${res.error === 'rate_limited' ? 'rateLimited' : 'unknown'}`));
  };

  if (state === 'signed') {
    return (
      <div dir="rtl" className="mx-auto max-w-xl px-6 py-16 text-center">
        <CheckCircle2 className="mx-auto size-14 text-emerald-500" aria-hidden="true" />
        <h2 className="mt-4 font-display text-2xl font-bold text-neutral-900">
          {t('successTitle')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          {t('successBody', { office: officeName })}
        </p>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div dir="rtl" className="mx-auto max-w-xl px-6 py-16 text-center">
        <h2 className="font-display text-2xl font-bold text-neutral-900">{t('expiredTitle')}</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          {t('expiredBody', { office: officeName })}
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <article className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-center font-display text-2xl font-bold text-neutral-900">{title}</h1>
        <div className="mx-auto mt-3 h-0.5 w-16 rounded bg-brand-gold" />

        <div className="mt-5 rounded-lg bg-brand-gold-soft px-4 py-3 text-sm leading-6 text-neutral-800">
          {partyLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        {sections.map((section) => (
          <section key={section.title} className="mt-5">
            <h2 className="text-sm font-bold text-neutral-900">{section.title}</h2>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 24)} className="mt-1.5 text-sm leading-6 text-neutral-700">
                {p}
              </p>
            ))}
          </section>
        ))}

        <div className="mt-7 border-t border-neutral-200 pt-5">
          <h2 className="text-sm font-bold text-neutral-900">{t('signatureTitle')}</h2>
          <p className="mb-3 mt-1 text-xs text-neutral-500">{t('signatureHint')}</p>
          <SignaturePad onChange={setSignature} />

          <label className="mt-4 flex items-start gap-2.5 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 accent-brand-gold-dark"
            />
            <span>{t('consent')}</span>
          </label>

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!signature || !consent || pending}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-brand-black transition hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {t('submit')}
          </button>
        </div>
      </article>
    </div>
  );
}
