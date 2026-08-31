import Image from 'next/image';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SignAgreementView } from '@/features/agreements/components/sign-agreement-view';
import { agreementBalance } from '@/features/agreements/domain/agreement-calc';
import {
  AGREEMENT_TITLE,
  buildAgreementSections,
} from '@/features/agreements/domain/agreement-text';
import { getAgreementForSigning } from '@/features/agreements/services/agreement-signing.service';
import { BRAND } from '@/lib/brand';
import { formatCurrency } from '@/lib/utils/format-currency';

export const metadata: Metadata = { title: AGREEMENT_TITLE };

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,100}$/;

/**
 * Public signing page. No auth — the 256-bit single-use token in the path IS
 * the credential (middleware doesn't gate /sign; it's absent from the
 * protected-route list). Unknown/cancelled tokens all collapse into one
 * generic "invalid link" view so the URL space probes nothing.
 */
export default async function SignAgreementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const agreement = TOKEN_SHAPE.test(token) ? await getAgreementForSigning(token) : null;
  const signable = agreement !== null && agreement.status === 'sent' && !agreement.expired;

  return (
    // The document body is position:fixed (globals.css) — public pages opt
    // back into scrolling by owning the viewport, like /check.
    <main dir="rtl" className="intake-scroll h-full overflow-y-auto bg-brand-gold-soft">
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
        <p className="text-sm text-neutral-400">{BRAND.taglineHe}</p>
      </header>

      {agreement ? (
        <SignAgreementView
          token={token}
          title={AGREEMENT_TITLE}
          officeName={BRAND.nameHe}
          // A spent link (already signed / expired) renders only its notice —
          // so it must not CARRY the agreement either. These props land in the
          // response body whether or not they are displayed, and the link
          // outlives its purpose in the client's inbox, so the identity + fee
          // are withheld once the link can no longer be used to sign.
          partyLines={
            signable
              ? buildPartyLines(agreement.clientName, {
                  nationalId: agreement.clientNationalId,
                  phone: agreement.clientPhone,
                  email: agreement.clientEmail,
                })
              : []
          }
          sections={
            signable
              ? buildAgreementSections({
                  officeName: BRAND.nameHe,
                  officePhone: BRAND.contact.phone ?? '',
                  officeEmail: BRAND.contact.email ?? '',
                  feeTotalText: formatCurrency(agreement.feeTotal, 'he'),
                  feeAdvanceText: formatCurrency(agreement.feeAdvance, 'he'),
                  feeBalanceText: formatCurrency(
                    agreementBalance(agreement.feeTotal, agreement.feeAdvance),
                    'he',
                  ),
                })
              : []
          }
          initialState={
            agreement.status === 'signed' ? 'signed' : agreement.expired ? 'expired' : 'ready'
          }
        />
      ) : (
        <InvalidLink />
      )}

      <footer className="pb-10 text-center text-xs text-neutral-500">
        © {BRAND.nameEn}
      </footer>
    </main>
  );
}

function buildPartyLines(
  clientName: string,
  details: { nationalId: string | null; phone: string | null; email: string | null },
): string[] {
  const clientParts = [
    `שם מלא: ${clientName}`,
    details.nationalId ? `ת.ז.: ${details.nationalId}` : null,
    details.phone ? `טלפון: ${details.phone}` : null,
    details.email ? `דוא"ל: ${details.email}` : null,
  ].filter((v): v is string => v !== null);
  return [`בין: ${BRAND.nameHe} ("המשרד")`, `לבין הלקוח: ${clientParts.join(' | ')}`];
}

async function InvalidLink() {
  const t = await getTranslations({ locale: 'he', namespace: 'agreements.sign' });
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-neutral-900">{t('invalidTitle')}</h1>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{t('invalidBody')}</p>
    </div>
  );
}
