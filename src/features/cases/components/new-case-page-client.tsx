'use client';

import { useState, useTransition } from 'react';

import {
  Briefcase,
  FolderArchive,
  Home,
  Landmark,
  Receipt,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatDateShort } from '@/lib/utils/format-date';

import { BlockerRow, DataRow, InsuranceRow } from './case-info-rows';
import { DraftActionBar } from './draft-action-bar';
import { DraftBorrowersBlock } from './draft-borrowers-block';
import { DraftLockedBlock } from './draft-locked-block';
import { DraftRequestDetailsBlock } from './draft-request-details-block';

import { saveCaseDraftAction } from '../actions/save-case-draft';
import { formatMoney } from '../domain/format';
import { useCaseDraftState } from '../hooks/use-case-draft-state';

import type { Locale } from '@/lib/i18n/direction';

/**
 * The /cases/new page in draft mode. Layout one-for-one matches /cases/[id]:
 *
 *   DraftActionBar (gold-soft sticky, mirrors CaseActionBar)
 *   ├─ Borrowers block (editable, full client state)
 *   ├─ Incomes block (locked — empty-state preview + lock hint)
 *   ├─ Obligations block (locked)
 *   ├─ Property block (locked — DataRows with —)
 *   ├─ Banks block (locked)
 *   ├─ Admin block (locked — BlockerRow/InsuranceRow null variants)
 *   ├─ Tasks block (locked)
 *   ├─ Short note (locked, fullWidth)
 *   ├─ Request details (editable, fullWidth, RichTextEditor)
 *   └─ Documents (locked, fullWidth)
 *
 * The locked blocks render the same chrome + placeholder content the real
 * blocks would show when empty, with a subtle opacity + lock footer. This
 * keeps the visual contract "you're inside a case page" — just with most
 * fields not yet writable.
 */
type Props = {
  locale: Locale;
};

export function NewCasePageClient({ locale }: Props) {
  const tDraft = useTranslations('case.draft');
  const tBlocks = useTranslations('case.blocks');
  const tFields = useTranslations('case.fields');
  const tIncomes = useTranslations('incomes');
  const tObligations = useTranslations('obligations');
  const tTasks = useTranslations('tasks');
  const tc = useTranslations('common');

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

  // Block save until at least one borrower has both first + last name —
  // matches BorrowerFormSchema's required fields and the RPC's defense-in-depth
  // check. The action bar's "needBorrower" message reflects either state
  // (no borrowers, or borrowers without names).
  const hasNamedBorrower = state.borrowers.some(
    (b) => b.first_name?.trim() && b.last_name?.trim(),
  );
  const canSave = hasNamedBorrower && !pending;

  const borrowerNamesPreview =
    state.borrowers
      .map((b) => [b.first_name, b.last_name].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' & ');

  const onSave = (): void => {
    if (!canSave) return;
    setGenericError(null);
    const payload = {
      request_details: state.requestDetailsHtml || null,
      borrowers: state.borrowers.map((b) => {
        // Strip the client-only tempId before sending — the RPC doesn't read
        // it. Named destructure + explicit return keeps the wire shape clear.
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
        } else {
          setGenericError(tDraft('errors.generic'));
        }
      }
      // Success: redirect throws inside the action; we never reach this line.
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
        {/* Editable — borrowers. */}
        <DraftBorrowersBlock
          borrowers={state.borrowers}
          onAdd={addBorrower}
          onUpdate={updateBorrower}
          onRemove={removeBorrower}
        />

        {/* Incomes / obligations preview. Same empty-state strings the live
            blocks use ("הוסף לווה לתיק כדי להזין הכנסות") so the chrome and
            body read identically when there's no data yet. */}
        <DraftLockedBlock title={tBlocks('incomes')} icon={<Wallet />}>
          <p className="text-sm text-neutral-600 text-center py-4">
            {tIncomes('noBorrowers')}
          </p>
        </DraftLockedBlock>

        <DraftLockedBlock title={tBlocks('obligations')} icon={<Receipt />}>
          <p className="text-sm text-neutral-600 text-center py-4">
            {tObligations('noBorrowers')}
          </p>
        </DraftLockedBlock>

        {/* Locked — property: DataRows with em-dash placeholders. */}
        <DraftLockedBlock title={tBlocks('property')} icon={<Home />}>
          <DataRow label={tFields('propertyValue')} value={formatMoney(null)} large />
          <DataRow
            label={tFields('requestedMortgageAmount')}
            value={formatMoney(null)}
            large
          />
          <DataRow label={tFields('equity')} value={formatMoney(null)} />
        </DraftLockedBlock>

        {/* Locked — banks. */}
        <DraftLockedBlock title={tBlocks('banks')} icon={<Landmark />}>
          <p className="text-sm text-neutral-500 text-center py-4">
            {tBlocks('noBanks')}
          </p>
        </DraftLockedBlock>

        {/* Admin block — same icon (Wallet) and same row shape as the live
            CaseAdminBlock: blocker / insurance / referrer / advisor /
            createdAt. Financials are intentionally omitted in draft (they
            require an admin gate + a real case_id to upsert; the rows
            appear after redirect to /cases/[id]). */}
        <DraftLockedBlock title={tBlocks('admin')} icon={<Wallet />}>
          <BlockerRow blocker={null} />
          <InsuranceRow status={null} />
          <DataRow label={tFields('referrer')} value="—" />
          <DataRow label={tFields('advisor')} value={`— ${tc('notAssigned')} —`} />
          <DataRow
            label={tFields('createdAt')}
            value={formatDateShort(new Date().toISOString(), locale)}
          />
        </DraftLockedBlock>

        {/* Tasks — same empty-state string the live TasksList shows. */}
        <DraftLockedBlock title={tBlocks('tasks')} icon={<Briefcase />}>
          <p className="text-sm text-neutral-600 text-center py-4">
            {tTasks('emptyCase')}
          </p>
        </DraftLockedBlock>

        {/* Locked — short note. Same italic-empty visual the real page uses. */}
        <DraftLockedBlock title={tBlocks('shortNote')} icon={<Briefcase />} fullWidth>
          <p className="text-sm text-neutral-600 italic">{tBlocks('shortNoteEmpty')}</p>
        </DraftLockedBlock>

        {/* Editable — request details (rich text). */}
        <DraftRequestDetailsBlock
          html={state.requestDetailsHtml}
          onChange={setRequestDetails}
        />

        {/* Locked — documents. */}
        <DraftLockedBlock
          title={tBlocks('documents')}
          icon={<FolderArchive />}
          fullWidth
        >
          <p className="text-sm text-neutral-600 text-center py-4">
            {tBlocks('documentsHint')}
          </p>
        </DraftLockedBlock>
      </div>
    </div>
  );
}
