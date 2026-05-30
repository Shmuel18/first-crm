'use client';

import { useState, useTransition } from 'react';

import { Home, Receipt, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useCaseDraftState } from '../hooks/use-case-draft-state';

import { DraftActionBar } from './draft-action-bar';
import { DraftAdminBlock } from './draft-admin-block';
import { DraftBorrowersBlock } from './draft-borrowers-block';
import { DraftLockedBlock } from './draft-locked-block';
import { DraftRequestDetailsBlock } from './draft-request-details-block';

import { saveCaseDraftAction } from '../actions/save-case-draft';

import type { Locale } from '@/lib/i18n/direction';
import { formatPersonName } from '@/lib/utils/person-name';

/**
 * /cases/new mirrors the live case page. In draft mode only the first two
 * sections are editable; the rest keep the same block chrome but stay locked
 * until the case has a persisted id.
 */
type Props = {
  locale: Locale;
};

export function NewCasePageClient({ locale }: Props) {
  const tDraft = useTranslations('case.draft');
  const tBlocks = useTranslations('case.blocks');

  const {
    state,
    addBorrower,
    updateBorrower,
    removeBorrower,
    setRequestDetails,
    clearDirty,
  } = useCaseDraftState();

  const [genericError, setGenericError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasNamedBorrower = state.borrowers.some(
    (b) => b.first_name?.trim() && b.last_name?.trim(),
  );
  const canSave = hasNamedBorrower && !pending;

  const borrowerNamesPreview =
    state.borrowers
      .map((b) => formatPersonName(b.first_name, b.last_name))
      .filter(Boolean)
      .join(' & ');

  const onSave = (): void => {
    if (!canSave) return;
    setGenericError(null);
    const payload = {
      request_details: state.requestDetailsHtml || null,
      borrowers: state.borrowers.map((b) => {
        const { tempId, ...rest } = b;
        void tempId;
        return rest;
      }),
    };

    clearDirty();

    startTransition(async () => {
      const result = await saveCaseDraftAction(payload);
      if (result.ok === false) {
        if (result.error === 'validation') {
          setGenericError(tDraft('errors.validation'));
        } else if (result.error === 'unauthorized') {
          setGenericError(tDraft('errors.unauthorized'));
        } else if (result.error === 'setup') {
          setGenericError(tDraft('errors.setup'));
        } else {
          setGenericError(tDraft('errors.generic'));
        }
      }
    });
  };

  return (
    <div className="space-y-5 -mt-6">
      <DraftActionBar
        locale={locale}
        borrowerNamesPreview={borrowerNamesPreview}
        canSave={canSave}
        pending={pending}
        onSave={onSave}
      />

      {genericError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
        >
          {genericError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DraftBorrowersBlock
          borrowers={state.borrowers}
          onAdd={addBorrower}
          onUpdate={updateBorrower}
          onRemove={removeBorrower}
        />

        <DraftRequestDetailsBlock
          html={state.requestDetailsHtml}
          onChange={setRequestDetails}
        />

        <DraftLockedBlock title={tBlocks('incomes')} icon={<Wallet />} fullWidth />
        <DraftLockedBlock title={tBlocks('obligations')} icon={<Receipt />} fullWidth />
        <DraftLockedBlock title={tBlocks('property')} icon={<Home />} fullWidth />
        <DraftAdminBlock />
      </div>
    </div>
  );
}
