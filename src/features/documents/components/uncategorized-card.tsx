'use client';

import { useTransition } from 'react';

import { AlertCircle, FileType2, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { assignDocumentCategoryAction } from '../actions/assign-document-category';
import type { DocumentCategoryRow, DocumentWithRelations } from '../types';

type Props = {
  documents: DocumentWithRelations[];
  categories: DocumentCategoryRow[];
  caseId: string;
  onPreview: (doc: DocumentWithRelations) => void;
};

function fileIcon(mime: string | null): React.ComponentType<{ className?: string }> {
  if (!mime) return FileType2;
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return FileType2;
}

export function UncategorizedCard({ documents, categories, caseId, onPreview }: Props) {
  const t = useTranslations('documents.uncategorized');

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
      <header className="flex items-center gap-2 mb-3">
        <div className="size-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <AlertCircle className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-base font-semibold text-neutral-900 leading-tight">
            {t('title', { count: documents.length })}
          </h2>
          <p className="text-xs text-neutral-600 mt-0.5">{t('subtitle')}</p>
        </div>
      </header>

      <div className="space-y-1.5">
        {documents.map((doc) => (
          <UncategorizedRow
            key={doc.id}
            doc={doc}
            categories={categories}
            caseId={caseId}
            onPreview={onPreview}
          />
        ))}
      </div>
    </section>
  );
}

function UncategorizedRow({
  doc,
  categories,
  caseId,
  onPreview,
}: {
  doc: DocumentWithRelations;
  categories: DocumentCategoryRow[];
  caseId: string;
  onPreview: (doc: DocumentWithRelations) => void;
}) {
  const t = useTranslations('documents.uncategorized');
  const [isPending, startTransition] = useTransition();
  const Icon = fileIcon(doc.mime_type);

  const handleChange = (categoryId: string) => {
    if (!categoryId) return;
    startTransition(async () => {
      await assignDocumentCategoryAction(doc.id, caseId, categoryId);
    });
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white border border-amber-100">
      <button
        type="button"
        onClick={() => onPreview(doc)}
        className="flex items-center gap-2 flex-1 min-w-0 text-start hover:opacity-80 transition"
      >
        <Icon className="size-4 text-neutral-400 shrink-0" />
        <span className="text-sm text-neutral-900 truncate">{doc.file_name}</span>
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        <select
          aria-label={t('pickCategory')}
          disabled={isPending}
          defaultValue=""
          onChange={(e) => handleChange(e.target.value)}
          className="h-8 rounded-md border border-amber-200 bg-white px-2 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#C9A961] disabled:opacity-50 max-w-[140px]"
        >
          <option value="" disabled>
            {t('pickCategory')}
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_he}
            </option>
          ))}
        </select>
        {isPending && <Loader2 className="size-3.5 animate-spin text-amber-600" />}
      </div>
    </div>
  );
}
