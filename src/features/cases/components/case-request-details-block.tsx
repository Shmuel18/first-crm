'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';

import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { updateCaseFieldAction } from '../actions/update-case-field';

import { CaseBlock } from './case-block';

// Lazy-load TipTap (~370KB) — same pattern as the draft block. Idle
// until the user actually opens this block.
const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-400"
        style={{ minHeight: '15rem' }}
      />
    ),
  },
);

type Props = {
  caseId: string;
  initialHtml: string | null;
};

/**
 * Inline-editable rich-text block for cases.request_details on the case
 * detail page. Save-on-blur, mirroring the short-note pattern — no
 * explicit save button.
 */
export function CaseRequestDetailsBlock({ caseId, initialHtml }: Props) {
  const t = useTranslations('case');
  const tForm = useTranslations('case.form.fields');

  const [html, setHtml] = useState<string>(initialHtml ?? '');
  const [savedHtml, setSavedHtml] = useState<string>(initialHtml ?? '');

  const handleBlur = async (next: string): Promise<void> => {
    // TipTap returns "<p></p>" for an empty editor — treat that as null
    // so the empty state and DB shape stay consistent with the rest of
    // the schema (cases.request_details is nullable).
    const normalised = next === '<p></p>' ? '' : next;
    if (normalised === savedHtml) return;
    const result = await updateCaseFieldAction(
      caseId,
      'request_details',
      normalised || null,
    );
    if (result.ok) {
      setSavedHtml(normalised);
    } else {
      // Revert local state on failure so the next blur compares against
      // the last server-confirmed value, not the rejected draft.
      setHtml(savedHtml);
    }
  };

  return (
    <CaseBlock title={t('blocks.requestDetails')} icon={<FileText />} fullWidth blockKey="requestDetails">
      <RichTextEditor
        value={html}
        onChange={setHtml}
        onBlur={handleBlur}
        placeholder={tForm('requestDetailsPlaceholder')}
        minRows={8}
      />
    </CaseBlock>
  );
}
