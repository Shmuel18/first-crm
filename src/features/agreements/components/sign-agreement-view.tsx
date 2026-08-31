'use client';

import { useState } from 'react';

import { CheckCircle2, Loader2 } from 'lucide-react';

import { callAction } from '@/lib/actions/call-action';

import { submitAgreementSignatureAction } from '../actions/submit-agreement-signature';
import { SignaturePad } from './signature-pad';

import type { AgreementDocument, AgreementLanguage } from '../domain/agreement-text';

/**
 * Every string this surface renders, resolved SERVER-side in the agreement's
 * own language. Deliberately not useTranslations: the visitor is anonymous, so
 * the locale cookie is whatever the browser defaulted to — an English client
 * on a Hebrew-defaulted phone must still read an entirely English page.
 */
export type SignViewStrings = {
  signatureTitle: string;
  signatureHint: string;
  consent: string;
  submit: string;
  successTitle: string;
  successBody: string;
  expiredTitle: string;
  expiredBody: string;
  invalidTitle: string;
  invalidBody: string;
  errorRateLimited: string;
  errorUnknown: string;
  padAria: string;
  padHint: string;
  clear: string;
};

type Props = {
  token: string;
  language: AgreementLanguage;
  strings: SignViewStrings;
  /** The fully-rendered wording; null once the link is spent. */
  document: AgreementDocument | null;
  /** "Client: name | ID | phone | email", composed server-side. */
  clientLine: string;
  /** 'ready' | 'signed' (already) | 'expired' — the page resolves this. */
  initialState: 'ready' | 'signed' | 'expired';
};

type ViewState = 'ready' | 'signed' | 'expired' | 'invalid';

/**
 * The client-facing signing surface: the agreement text (server-rendered from
 * the row's frozen snapshot, same source as the PDF), a consent checkbox, the
 * signature pad, and submit. Direction follows the AGREEMENT's language — the
 * document is the thing being read.
 */
export function SignAgreementView({
  token,
  language,
  strings,
  document,
  clientLine,
  initialState,
}: Props) {
  const [signature, setSignature] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<ViewState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const dir = language === 'he' ? 'rtl' : 'ltr';

  const submit = async (): Promise<void> => {
    if (!signature || !consent || pending) return;
    setPending(true);
    setError(null);
    const res = await callAction(() =>
      submitAgreementSignatureAction({ token, signaturePng: signature }),
    );
    setPending(false);
    if (res.ok || res.error === 'already_signed') {
      setState('signed');
      return;
    }
    if (res.error === 'expired') {
      setState('expired');
      return;
    }
    // The link was cancelled or replaced while this page was open — retrying
    // can never succeed, so say so instead of offering a retryable error.
    if (res.error === 'invalid_link') {
      setState('invalid');
      return;
    }
    setError(res.error === 'rate_limited' ? strings.errorRateLimited : strings.errorUnknown);
  };

  if (state === 'signed') {
    return (
      <Notice dir={dir} title={strings.successTitle} body={strings.successBody} icon />
    );
  }
  if (state === 'expired') {
    return <Notice dir={dir} title={strings.expiredTitle} body={strings.expiredBody} />;
  }
  if (state === 'invalid') {
    return <Notice dir={dir} title={strings.invalidTitle} body={strings.invalidBody} />;
  }
  if (!document) return null;

  return (
    <div dir={dir} className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <article className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-center font-display text-2xl font-bold text-neutral-900">
          {document.title}
        </h1>
        <div className="mx-auto mt-3 h-0.5 w-16 rounded bg-brand-gold" />

        <div className="mt-5 rounded-lg bg-brand-gold-soft px-4 py-3 text-sm leading-6 text-neutral-800">
          <p>{document.preamble}</p>
          <p>{clientLine}</p>
        </div>

        {document.sections.map((section) => (
          <section key={section.title} className="mt-5">
            <h2 className="text-sm font-bold text-neutral-900">{section.title}</h2>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 32)} className="mt-1.5 text-sm leading-6 text-neutral-700">
                {p}
              </p>
            ))}
          </section>
        ))}

        <div className="mt-7 border-t border-neutral-200 pt-5">
          <h2 className="text-sm font-bold text-neutral-900">{strings.signatureTitle}</h2>
          <p className="mb-3 mt-1 text-xs text-neutral-500">{strings.signatureHint}</p>
          <SignaturePad
            onChange={setSignature}
            ariaLabel={strings.padAria}
            hint={strings.padHint}
            clearLabel={strings.clear}
          />

          <label className="mt-4 flex items-start gap-2.5 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 accent-brand-gold-dark"
            />
            <span>{strings.consent}</span>
          </label>

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!signature || !consent || pending}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-brand-black transition hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {strings.submit}
          </button>
        </div>
      </article>
    </div>
  );
}

function Notice({
  dir,
  title,
  body,
  icon,
}: {
  dir: 'rtl' | 'ltr';
  title: string;
  body: string;
  icon?: boolean;
}) {
  return (
    <div dir={dir} className="mx-auto max-w-xl px-6 py-16 text-center">
      {icon && <CheckCircle2 className="mx-auto mb-4 size-14 text-emerald-500" aria-hidden="true" />}
      <h2 className="font-display text-2xl font-bold text-neutral-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
    </div>
  );
}
