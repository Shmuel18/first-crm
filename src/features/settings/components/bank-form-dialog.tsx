'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

import Image from 'next/image';

import { ImagePlus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { createClient } from '@/lib/supabase/client';

import { createBankAction } from '../actions/create-bank';
import { updateBankAction } from '../actions/update-bank';
import { BANK_ACTION_INITIAL, LENDER_TYPES, type BankActionState } from '../schemas/bank.schema';
import { BANK_LOGOS_BUCKET, type Bank } from '../services/banks.service';

const LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const LOGO_MAX_BYTES = 1_048_576; // 1 MB

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  bank: Bank | null;
};

export function BankFormDialog({ open, onOpenChange, mode, bank }: Props) {
  const t = useTranslations('settings.banks');
  const tc = useTranslations('common');
  const action = mode === 'create' ? createBankAction : updateBankAction;
  const [state, formAction] = useActionState<BankActionState, FormData>(action, BANK_ACTION_INITIAL);

  const [logoUrl, setLogoUrl] = useState<string | null>(bank?.logo_url ?? null);
  const [color, setColor] = useState<string>(bank?.color ?? '#C9A961');
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Transient state is seeded from props on mount; the parent keys this dialog
  // by bank id, so switching bank / new remounts and re-seeds cleanly.
  useEffect(() => {
    if (state.ok === true) onOpenChange(false);
  }, [state, onOpenChange]);

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};

  const onLogoChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError(null);
    if (!LOGO_MIME.includes(file.type)) return setLogoError(t('logoTypeError'));
    if (file.size > LOGO_MAX_BYTES) return setLogoError(t('logoSizeError'));

    setUploading(true);
    try {
      const sb = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage
        .from(BANK_LOGOS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) {
        setLogoError(t('logoUploadError'));
        return;
      }
      setLogoUrl(sb.storage.from(BANK_LOGOS_BUCKET).getPublicUrl(path).data.publicUrl);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('form.create') : t('form.edit')}</DialogTitle>
        </DialogHeader>

        <form key={bank?.id ?? 'new'} action={formAction} className="space-y-4" noValidate>
          {mode === 'edit' && bank && <input type="hidden" name="bank_id" value={bank.id} />}
          <input type="hidden" name="logo_url" value={logoUrl ?? ''} />
          <input type="hidden" name="color" value={color} />

          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <label htmlFor="bank-logo" className="block cursor-pointer">
                <span
                  className="relative flex size-16 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
                  style={!logoUrl ? { backgroundColor: color } : undefined}
                >
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-contain p-1"
                      unoptimized={logoUrl.endsWith('.svg')}
                    />
                  ) : uploading ? (
                    <Loader2 className="size-5 animate-spin text-white" aria-hidden="true" />
                  ) : (
                    <ImagePlus className="size-5 text-white/90" aria-hidden="true" />
                  )}
                </span>
              </label>
              <input
                id="bank-logo"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg"
                className="sr-only"
                onChange={(e) => void onLogoChange(e)}
              />
              <p className="mt-1 text-center text-[11px] text-neutral-500">{t('fields.logo')}</p>
            </div>

            <div className="flex-1 space-y-3">
              <FormField label={t('fields.nameHe')} required error={fieldErrors.name_he}>
                <Input name="name_he" defaultValue={bank?.name_he ?? ''} dir="rtl" autoFocus maxLength={120} />
              </FormField>
              <FormField label={t('fields.nameEn')} required error={fieldErrors.name_en}>
                <Input name="name_en" defaultValue={bank?.name_en ?? ''} dir="ltr" maxLength={120} />
              </FormField>
            </div>
          </div>

          {logoError && <p className="text-xs text-rose-600">{logoError}</p>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('fields.lenderType')} error={fieldErrors.lender_type}>
              <NativeSelect name="lender_type" defaultValue={bank?.lender_type ?? 'bank'}>
                {LENDER_TYPES.map((lt) => (
                  <option key={lt} value={lt}>
                    {t(`lenderTypes.${lt}`)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('fields.color')} error={fieldErrors.color}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label={t('fields.color')}
                className="h-10 w-full cursor-pointer rounded-md border border-neutral-300 bg-white p-1"
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={bank?.is_active ?? true}
              className="size-4 rounded border-neutral-300 text-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/40"
            />
            {t('fields.active')}
          </label>

          {state.ok === false && (state.error === 'unknown' || state.error === 'unauthorized') && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t('toast.failed')}
            </div>
          )}

          <DialogFooter>
            <SubmitButton mode={mode} uploading={uploading} />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({ mode, uploading }: { mode: 'create' | 'edit'; uploading: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations('settings.banks.submit');
  return (
    <Button
      type="submit"
      disabled={pending || uploading}
      className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold"
    >
      {pending || uploading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : mode === 'create' ? (
        t('create')
      ) : (
        t('update')
      )}
    </Button>
  );
}
