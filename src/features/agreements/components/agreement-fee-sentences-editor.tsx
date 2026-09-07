'use client';

import { useState } from 'react';

import { Loader2, RotateCcw, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { callAction } from '@/lib/actions/call-action';

import { saveAgreementFeeTextAction } from '../actions/save-agreement-fee-text';
import {
  DEFAULT_FEE_SENTENCES,
  FEE_SENTENCE_KEYS,
  REQUIRED_FEE_PLACEHOLDERS,
  feeSentenceIsComplete,
} from '../domain/agreement-fee-text';

import type { FeeSentenceKey, FeeSentenceTemplates } from '../domain/agreement-fee-text';
import type { AgreementLanguage } from '../domain/agreement-text';

type Props = {
  language: AgreementLanguage;
  initial: Record<AgreementLanguage, FeeSentenceTemplates>;
};

/**
 * Settings → Engagement agreement: the fee clauses.
 *
 * They live apart from the document because which one prints depends on the
 * deal — a percentage or a flat sum, an advance or none. The office edits every
 * variant here; the send picks between them. Figures are never typed: each
 * sentence keeps the placeholders the system fills, and a save that drops one
 * is refused rather than printing a clause that states no price.
 */
export function AgreementFeeSentencesEditor({ language, initial }: Props) {
  const t = useTranslations('agreements.feeText');
  const [all, setAll] = useState<Record<AgreementLanguage, FeeSentenceTemplates>>(initial);
  const [pending, setPending] = useState(false);

  const sentences = all[language];
  const rtl = language === 'he';

  const update = (key: FeeSentenceKey, value: string): void =>
    setAll((prev) => ({ ...prev, [language]: { ...prev[language], [key]: value } }));

  const incomplete = FEE_SENTENCE_KEYS.filter(
    (key) => !feeSentenceIsComplete(key, sentences[key]) || !sentences[key].trim(),
  );

  const save = async (): Promise<void> => {
    if (pending || incomplete.length > 0) return;
    setPending(true);
    const res = await callAction(() => saveAgreementFeeTextAction({ language, sentences }));
    setPending(false);
    if (!res.ok) {
      toast.error(t(`errors.${res.error}`));
      return;
    }
    toast.success(t('saved'));
  };

  const resetToDefault = (): void => {
    setAll((prev) => ({ ...prev, [language]: { ...DEFAULT_FEE_SENTENCES[language] } }));
    toast.info(t('resetHint'));
  };

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold text-neutral-900">{t('title')}</h3>
          <p className="mt-0.5 text-sm text-neutral-500">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetToDefault}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t('reset')}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={pending || incomplete.length > 0}
            className="bg-brand-gold text-brand-black hover:bg-brand-gold-hover inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {t('save')}
          </button>
        </div>
      </div>

      {FEE_SENTENCE_KEYS.map((key) => {
        const required = REQUIRED_FEE_PLACEHOLDERS[key];
        const value = sentences[key];
        const broken = !value.trim() || !feeSentenceIsComplete(key, value);
        return (
          <div key={key} className="grid gap-1.5">
            <Label htmlFor={`fee-sentence-${key}`}>{t(`labels.${key}`)}</Label>
            <p className="text-xs text-neutral-500">{t(`hints.${key}`)}</p>
            <Textarea
              id={`fee-sentence-${key}`}
              dir={rtl ? 'rtl' : 'ltr'}
              rows={3}
              aria-invalid={broken}
              value={value}
              onChange={(e) => update(key, e.target.value)}
            />
            {required.length > 0 && (
              <p className={broken ? 'text-xs text-red-600' : 'text-xs text-neutral-500'}>
                {broken ? t('missingPlaceholder') : t('mustKeep')}{' '}
                {required.map((p) => (
                  <code
                    key={p}
                    className="mx-0.5 rounded bg-neutral-100 px-1 py-0.5 font-mono text-[11px]"
                  >
                    {`{{${p}}}`}
                  </code>
                ))}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
