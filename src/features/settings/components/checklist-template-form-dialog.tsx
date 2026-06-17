'use client';

import { useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, NativeSelect } from '@/components/shared/form-fields';

import { createChecklistTemplateAction } from '../actions/create-checklist-template';
import { updateChecklistTemplateAction } from '../actions/update-checklist-template';
import {
  CHECKLIST_TEMPLATE_GROUP_VALUES,
  type ChecklistTemplateGroupValue,
} from '../schemas/checklist-template.schema';

import type { ChecklistTemplateAdminRow } from '../services/checklist-templates.service';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ChecklistTemplateAdminRow | null;
};

/**
 * Create/edit a preset checklist template. Items are edited one-per-line and
 * split to an array on submit. System seed templates are fully editable here
 * (the office tweaks its work-lists) — only deletion is locked. Fields are
 * controlled (not React-19 form-action defaultValue) so values survive the
 * pending transition; the parent keys this dialog by id, re-seeding on open.
 */
export function ChecklistTemplateFormDialog({ open, onOpenChange, template }: Props) {
  const t = useTranslations('settings.checklists');
  const tc = useTranslations('common');
  const mode = template ? 'edit' : 'create';
  const [isPending, startTransition] = useTransition();

  const [nameHe, setNameHe] = useState(template?.name_he ?? '');
  const [nameEn, setNameEn] = useState(template?.name_en ?? '');
  const [group, setGroup] = useState<ChecklistTemplateGroupValue>(template?.group_key ?? 'process');
  const [itemsText, setItemsText] = useState((template?.items ?? []).join('\n'));
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [nameError, setNameError] = useState(false);

  const save = () => {
    const name_he = nameHe.trim();
    if (!name_he) {
      setNameError(true);
      return;
    }
    setNameError(false);

    const payload = {
      name_he,
      name_en: nameEn.trim(),
      group_key: group,
      is_active: isActive,
      items: itemsText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    };

    startTransition(async () => {
      const res = template
        ? await updateChecklistTemplateAction({ ...payload, id: template.id })
        : await createChecklistTemplateAction(payload);
      if (!res.ok) {
        toast.error(tc('saveFailed'));
        return;
      }
      toast.success(t('form.saved'));
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('form.create') : t('form.edit')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label={t('fields.nameHe')}
              required
              error={nameError ? t('fields.nameRequired') : undefined}
            >
              <Input
                value={nameHe}
                onChange={(e) => setNameHe(e.target.value)}
                dir="rtl"
                autoFocus
                maxLength={120}
              />
            </FormField>
            <FormField label={t('fields.nameEn')}>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                dir="ltr"
                maxLength={120}
              />
            </FormField>
          </div>

          <FormField label={t('fields.group')}>
            <NativeSelect
              value={group}
              onChange={(e) => setGroup(e.target.value as ChecklistTemplateGroupValue)}
            >
              {CHECKLIST_TEMPLATE_GROUP_VALUES.map((g) => (
                <option key={g} value={g}>
                  {t(`groups.${g}`)}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField label={t('fields.items')} htmlFor="checklist-items">
            <Textarea
              id="checklist-items"
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              dir="rtl"
              rows={8}
              placeholder={t('fields.itemsPlaceholder')}
            />
          </FormField>
          <p className="-mt-2 text-xs text-neutral-500">{t('fields.itemsHint')}</p>

          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 rounded border-neutral-300 text-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/40"
            />
            {t('fields.active')}
          </label>

          <DialogFooter>
            <Button
              type="button"
              onClick={save}
              disabled={isPending}
              className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : mode === 'create' ? (
                t('form.createSubmit')
              ) : (
                t('form.editSubmit')
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
