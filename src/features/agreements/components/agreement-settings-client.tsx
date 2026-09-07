'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { AgreementFeeSentencesEditor } from './agreement-fee-sentences-editor';
import { AgreementTemplateEditor } from './agreement-template-editor';

import type { FeeSentenceTemplates } from '../domain/agreement-fee-text';
import type { AgreementDocument, AgreementLanguage } from '../domain/agreement-text';

type Props = {
  documents: Record<AgreementLanguage, AgreementDocument>;
  feeSentences: Record<AgreementLanguage, FeeSentenceTemplates>;
};

const LANGUAGES: AgreementLanguage[] = ['he', 'en'];

/**
 * Settings → Engagement agreement shell. Owns the language choice so the
 * document and the fee clauses are always edited in the SAME language — two
 * independent toggles on one page invite saving Hebrew prose into the English
 * agreement. Each editor still saves on its own.
 */
export function AgreementSettingsClient({ documents, feeSentences }: Props) {
  const t = useTranslations('agreements.template');
  const [language, setLanguage] = useState<AgreementLanguage>('he');

  return (
    <div className="space-y-6">
      <div className="flex overflow-hidden rounded-lg border border-neutral-200 w-fit">
        {LANGUAGES.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={language === l}
            onClick={() => setLanguage(l)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition',
              language === l
                ? 'bg-brand-gold text-brand-black'
                : 'bg-white text-neutral-600 hover:bg-neutral-50',
            )}
          >
            {t(`languages.${l}`)}
          </button>
        ))}
      </div>

      <AgreementTemplateEditor initial={documents} language={language} />
      <AgreementFeeSentencesEditor initial={feeSentences} language={language} />
    </div>
  );
}
