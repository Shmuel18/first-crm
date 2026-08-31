import Image from 'next/image';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import {
  SignAgreementView,
  type SignViewStrings,
} from '@/features/agreements/components/sign-agreement-view';
import { DEFAULT_AGREEMENT_TEXT } from '@/features/agreements/domain/agreement-text';
import { getAgreementForSigning } from '@/features/agreements/services/agreement-signing.service';
import { BRAND } from '@/lib/brand';

/** Tab title follows the AGREEMENT's language — an English client should not
 *  get a Hebrew tab. Shares the page's cached lookup, so no extra query. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const agreement = TOKEN_SHAPE.test(token) ? await getAgreementForSigning(token) : null;
  const fallback = DEFAULT_AGREEMENT_TEXT[agreement?.language ?? 'he'].title;
  return { title: agreement?.document?.title ?? fallback };
}

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,100}$/;

/**
 * Public signing page. No auth — the 256-bit single-use token in the path IS
 * the credential (middleware doesn't gate /sign; it's absent from the
 * protected-route list). Unknown/cancelled tokens all collapse into one
 * generic "invalid link" view so the URL space probes nothing.
 *
 * The page renders in the agreement's OWN language, not the visitor's locale
 * cookie — an English client gets the English document even on a Hebrew phone.
 */
export default async function SignAgreementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const agreement = TOKEN_SHAPE.test(token) ? await getAgreementForSigning(token) : null;
  // A row with no frozen wording (pre-migration-239) cannot be rendered
  // faithfully, so it is not signable either — see resolveDocument. Such a row
  // falls through to the invalid-link notice below rather than rendering an
  // empty page, which is what the client would otherwise be sent.
  const signable =
    agreement !== null &&
    agreement.status === 'sent' &&
    !agreement.expired &&
    agreement.document !== null;
  const language = agreement?.language ?? 'he';
  const he = language === 'he';
  const officeName = he ? BRAND.nameHe : BRAND.nameEn;
  const strings = await buildSignStrings(language, officeName);

  return (
    // The document body is position:fixed (globals.css) — public pages opt
    // back into scrolling by owning the viewport, like /check.
    <main
      dir={he ? 'rtl' : 'ltr'}
      className="intake-scroll h-full overflow-y-auto bg-brand-gold-soft"
    >
      <header className="bg-brand-black px-6 py-7 text-center">
        <div className="mx-auto mb-2 flex justify-center">
          <div className="relative h-14 w-[180px]">
            <Image
              src={BRAND.logoOnDark}
              alt={BRAND.nameEn}
              fill
              priority
              sizes="180px"
              className="object-contain"
            />
          </div>
        </div>
        <p className="text-sm text-neutral-400">{he ? BRAND.taglineHe : BRAND.taglineEn}</p>
      </header>

      {agreement && (signable || agreement.status === 'signed' || agreement.expired) ? (
        <SignAgreementView
          token={token}
          language={language}
          strings={strings}
          // A spent link (already signed / expired) renders only its notice —
          // so it must not CARRY the agreement either. These props land in the
          // response body whether or not they are displayed, and the link
          // outlives its purpose in the client's inbox, so the identity + fee
          // are withheld once the link can no longer be used to sign.
          document={signable ? agreement.document : null}
          clientLine={signable ? buildClientLine(agreement, language) : ''}
          initialState={
            agreement.status === 'signed' ? 'signed' : agreement.expired ? 'expired' : 'ready'
          }
        />
      ) : (
        <div className="mx-auto max-w-xl px-6 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-neutral-900">
            {strings.invalidTitle}
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600">{strings.invalidBody}</p>
        </div>
      )}

      <footer className="pb-10 text-center text-xs text-neutral-500">
        © {BRAND.nameEn}
      </footer>
    </main>
  );
}

function buildClientLine(
  agreement: { clientName: string; clientNationalId: string | null; clientPhone: string | null; clientEmail: string | null },
  language: 'he' | 'en',
): string {
  const l =
    language === 'he'
      ? { client: 'הלקוח', name: 'שם מלא', id: 'ת.ז.', phone: 'טלפון', email: 'דוא"ל' }
      : { client: 'Client', name: 'Full name', id: 'ID/Passport No.', phone: 'Phone', email: 'Email' };
  const parts = [
    `${l.name}: ${agreement.clientName}`,
    agreement.clientNationalId ? `${l.id} ${agreement.clientNationalId}` : null,
    agreement.clientPhone ? `${l.phone}: ${agreement.clientPhone}` : null,
    agreement.clientEmail ? `${l.email}: ${agreement.clientEmail}` : null,
  ].filter((v): v is string => v !== null);
  return `${l.client}: ${parts.join(' | ')}`;
}

/**
 * Resolve every visitor-facing string in the AGREEMENT's language. The signer
 * is anonymous, so the locale cookie says nothing about which language they
 * read — the document decides.
 */
async function buildSignStrings(
  language: 'he' | 'en',
  officeName: string,
): Promise<SignViewStrings> {
  const t = await getTranslations({ locale: language, namespace: 'agreements.sign' });
  return {
    signatureTitle: t('signatureTitle'),
    signatureHint: t('signatureHint'),
    consent: t('consent'),
    submit: t('submit'),
    successTitle: t('successTitle'),
    successBody: t('successBody', { office: officeName }),
    expiredTitle: t('expiredTitle'),
    expiredBody: t('expiredBody', { office: officeName }),
    invalidTitle: t('invalidTitle'),
    invalidBody: t('invalidBody'),
    errorRateLimited: t('errors.rateLimited'),
    errorUnknown: t('errors.unknown'),
    padAria: t('padAria'),
    padHint: t('padHint'),
    clear: t('clear'),
  };
}
