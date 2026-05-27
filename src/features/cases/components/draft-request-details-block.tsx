'use client';

import dynamic from 'next/dynamic';

import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CaseBlock } from './case-block';

// Lazy-load TipTap (~370KB) — same pattern as CaseForm. Idle until the
// block actually renders.
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
  html: string;
  onChange: (html: string) => void;
};

export function DraftRequestDetailsBlock({ html, onChange }: Props) {
  const t = useTranslations('case');
  const tForm = useTranslations('case.form.fields');

  return (
    <CaseBlock title={t('blocks.requestDetails')} icon={<FileText />} fullWidth defaultOpen>
      <RichTextEditor
        value={html}
        onChange={onChange}
        placeholder={tForm('requestDetailsPlaceholder')}
        minRows={8}
      />
    </CaseBlock>
  );
}
