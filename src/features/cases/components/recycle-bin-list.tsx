'use client';

import { useState, useTransition } from 'react';

import { AlertTriangle, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { Locale } from '@/lib/i18n/direction';
import { formatPersonName } from '@/lib/utils/person-name';
import { formatDateShort } from '@/lib/utils/format-date';

import { permanentDeleteCaseAction } from '../actions/permanent-delete-case';
import { restoreCaseAction } from '../actions/restore-case';
import type { DeletedCaseRow } from '../services/deleted-cases.service';

type Props = {
  rows: ReadonlyArray<DeletedCaseRow>;
  locale: Locale;
};

const NEAR_PURGE_DAYS = 3;

export function RecycleBinList({ rows, locale }: Props) {
  const t = useTranslations('settings.recycleBin');
  const [isPending, startTransition] = useTransition();
  const [confirmTarget, setConfirmTarget] = useState<DeletedCaseRow | null>(null);
  const [typedConfirm, setTypedConfirm] = useState('');

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 px-6 py-12 text-center">
        <Trash2
          aria-hidden="true"
          className="size-8 mx-auto text-neutral-300 mb-2"
        />
        <p className="text-sm text-neutral-600">{t('empty')}</p>
      </div>
    );
  }

  const handleRestore = (row: DeletedCaseRow) => {
    startTransition(async () => {
      const result = await restoreCaseAction(row.id);
      if (result.ok) {
        toast.success(t('restoreSuccess', { caseNumber: row.caseNumber }));
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  };

  const handleConfirmPermanentDelete = () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    startTransition(async () => {
      const result = await permanentDeleteCaseAction({
        caseId: target.id,
        confirmCaseNumber: typedConfirm,
      });
      if (result.ok) {
        toast.success(t('permanentDeleteSuccess', { caseNumber: target.caseNumber }));
        setConfirmTarget(null);
        setTypedConfirm('');
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  };

  return (
    <>
      <ul className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
        {rows.map((row) => {
          const fullName = formatPersonName(
            row.primaryBorrowerFirstName,
            row.primaryBorrowerLastName,
          );
          const deletedByName = formatPersonName(row.deletedByFirstName, row.deletedByLastName);
          const statusName =
            (locale === 'he' ? row.statusNameHe : row.statusNameEn) ?? '';
          const isNearPurge = row.daysUntilPurge <= NEAR_PURGE_DAYS;

          return (
            <li key={row.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-neutral-500">#{row.caseNumber}</span>
                  <span className="font-medium text-sm text-neutral-900 truncate">
                    {fullName || t('noBorrower')}
                  </span>
                  {statusName && (
                    <span className="text-xs text-neutral-500 truncate">· {statusName}</span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>
                    {t('deletedAt', { date: formatDateShort(row.deletedAt, locale) })}
                  </span>
                  {deletedByName && (
                    <span>· {t('deletedBy', { name: deletedByName })}</span>
                  )}
                  <span
                    className={
                      isNearPurge
                        ? 'inline-flex items-center gap-1 text-red-700 font-medium'
                        : 'text-neutral-500'
                    }
                  >
                    ·{' '}
                    {isNearPurge && <AlertTriangle aria-hidden="true" className="size-3" />}
                    {t('purgeIn', { days: row.daysUntilPurge })}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestore(row)}
                disabled={isPending}
                className="gap-1.5"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
                {t('actions.restore')}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('actions.more')}
                      disabled={isPending}
                    >
                      <MoreHorizontal aria-hidden="true" className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuItem
                    onClick={() => {
                      setConfirmTarget(row);
                      setTypedConfirm('');
                    }}
                    className="text-xs py-1 px-2.5 justify-center text-red-600 focus:text-red-700 focus:bg-red-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    {t('actions.permanentDelete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmTarget(null);
            setTypedConfirm('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{t('confirmDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmTarget
              ? t('confirmDialog.description', { caseNumber: confirmTarget.caseNumber })
              : ''}
          </AlertDialogDescription>
          <div className="space-y-1.5">
            <label
              htmlFor="permanent-delete-confirm"
              className="text-sm text-neutral-700"
            >
              {t('confirmDialog.typeToConfirm', {
                caseNumber: confirmTarget?.caseNumber ?? '',
              })}
            </label>
            <Input
              id="permanent-delete-confirm"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              placeholder={confirmTarget?.caseNumber ?? ''}
              dir="ltr"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <Button
              variant="destructive"
              onClick={handleConfirmPermanentDelete}
              disabled={
                isPending ||
                !confirmTarget ||
                typedConfirm.trim() !== confirmTarget.caseNumber.trim()
              }
            >
              {t('confirmDialog.confirm')}
            </Button>
            <AlertDialogCancel
              render={<Button variant="outline">{t('confirmDialog.cancel')}</Button>}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
