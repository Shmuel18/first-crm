'use client';

import { useId, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { COUNTRIES } from '@/lib/constants/countries';
import { parseLocale } from '@/lib/i18n/direction';

import type { EditableBorrowerField } from '../actions/update-borrower-field';

import type { BorrowerRow } from '../types';

type SaveFieldResult = { ok: true } | { ok: false; message?: string };

type Props = {
  borrower: Pick<
    BorrowerRow,
    'additional_citizenships' | 'residency_type' | 'foreign_residence_country'
  >;
  saveField: (
    field: EditableBorrowerField,
    value: string | null,
  ) => Promise<SaveFieldResult>;
};

/**
 * Two compact yes/no questions on the borrower card. "כן" reveals an
 * inline country input (text + datalist of common countries) right after
 * the toggle — same row, no boxes, matches the density of BorrowerMiscRow.
 *
 *   * "האם ישנן אזרחויות נוספות?" → additional_citizenships
 *   * "האם תושב חוץ?"             → foreign_residence_country + residency_type
 *
 * Toggle state is derived from existing data on mount. Switching to "לא"
 * clears the country (and flips residency_type back to 'resident' for the
 * residence question).
 */
export function BorrowerCitizenshipQuestions({ borrower, saveField }: Props) {
  const tf = useTranslations('borrowerForm.fields');
  const tc = useTranslations('common');
  const locale = parseLocale(useLocale());
  const listId = useId();

  const derivedAddl = Boolean(borrower.additional_citizenships?.trim());
  const derivedForeign = borrower.residency_type === 'foreign_resident';
  const [hasAddl, setHasAddl] = useState<boolean>(derivedAddl);
  const [isForeign, setIsForeign] = useState<boolean>(derivedForeign);

  // Re-sync the toggles when the underlying borrower data changes (a sibling
  // save revalidates the card, or an optimistic rollback restores the prop).
  // Render-phase setState (React 19 blocks the useEffect variant) — same
  // propRef sentinel the EditableField / CompactNumber inputs use.
  const [addlRef, setAddlRef] = useState(derivedAddl);
  if (derivedAddl !== addlRef) {
    setAddlRef(derivedAddl);
    setHasAddl(derivedAddl);
  }
  const [foreignRef, setForeignRef] = useState(derivedForeign);
  if (derivedForeign !== foreignRef) {
    setForeignRef(derivedForeign);
    setIsForeign(derivedForeign);
  }

  const onToggleAddl = async (yes: boolean): Promise<void> => {
    setHasAddl(yes);
    if (!yes && borrower.additional_citizenships) {
      const r = await saveField('additional_citizenships', null);
      if (!r.ok) {
        setHasAddl(true); // roll the toggle back so the input re-reveals
        toast.error(r.message || tc('saveFailed'));
      }
    }
  };

  // residency_type + foreign_residence_country need to stay in sync (column
  // pair). Two sequential saves with an explicit unwind if the second fails
  // so we don't strand the row in (resident, country=X) — the second save
  // is the one that clears the country, and a network blip there would
  // leave the inconsistency visible in /cases UI until the next edit.
  const onToggleForeign = async (yes: boolean): Promise<void> => {
    setIsForeign(yes);
    if (yes) {
      const r = await saveField('residency_type', 'foreign_resident');
      if (!r.ok) {
        setIsForeign(false);
        toast.error(r.message || tc('saveFailed'));
      }
      return;
    }
    const r1 = await saveField('residency_type', 'resident');
    if (!r1.ok) {
      setIsForeign(true);
      toast.error(r1.message || tc('saveFailed'));
      return;
    }
    if (borrower.foreign_residence_country) {
      const r2 = await saveField('foreign_residence_country', null);
      if (!r2.ok) {
        // Unwind: put residency_type back to foreign_resident so the
        // toggle's visible state matches what's actually persisted.
        await saveField('residency_type', 'foreign_resident');
        setIsForeign(true);
        toast.error(r2.message || tc('saveFailed'));
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-3 border-b border-neutral-100 last:border-0 text-sm">
      <CompactToggle
        label={tf('hasAdditionalCitizenship')}
        yes={hasAddl}
        onToggle={onToggleAddl}
        yesLabel={tc('yes')}
        noLabel={tc('no')}
      />
      {hasAddl && (
        <CountryInput
          listId={listId}
          value={borrower.additional_citizenships}
          placeholder={tf('countryPlaceholder')}
          onSave={(v) =>
            saveField('additional_citizenships', v).then((r) => {
              if (!r.ok) toast.error(r.message || tc('saveFailed'));
            })
          }
        />
      )}

      <CompactToggle
        label={tf('isForeignResident')}
        yes={isForeign}
        onToggle={onToggleForeign}
        yesLabel={tc('yes')}
        noLabel={tc('no')}
      />
      {isForeign && (
        <CountryInput
          listId={listId}
          value={borrower.foreign_residence_country}
          placeholder={tf('countryPlaceholder')}
          onSave={(v) =>
            saveField('foreign_residence_country', v).then((r) => {
              if (!r.ok) toast.error(r.message || tc('saveFailed'));
            })
          }
        />
      )}

      {/* Shared datalist of common countries — both inputs autocomplete
          against the same list. Free-text values are still accepted (the
          column is plain TEXT) so unusual countries the list doesn't cover
          can be typed directly. */}
      <datalist id={listId}>
        {COUNTRIES.map((c) => {
          const name = locale === 'he' ? c.name_he : c.name_en;
          return (
            <option key={c.code} value={name}>
              {name}
            </option>
          );
        })}
      </datalist>
    </div>
  );
}

function CompactToggle({
  label,
  yes,
  onToggle,
  yesLabel,
  noLabel,
}: {
  label: string;
  yes: boolean;
  onToggle: (next: boolean) => void;
  yesLabel: string;
  noLabel: string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-neutral-500">{label}</span>
      <select
        value={yes ? 'yes' : 'no'}
        onChange={(e) => onToggle(e.target.value === 'yes')}
        className="h-8 px-2 pe-6 rounded-md border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition appearance-none bg-[length:0.875rem] bg-no-repeat rtl:bg-[left_0.4rem_center] ltr:bg-[right_0.4rem_center]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23737373'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
        }}
      >
        <option value="no">{noLabel}</option>
        <option value="yes">{yesLabel}</option>
      </select>
    </label>
  );
}

/**
 * Text input wired to a shared datalist — gives the user a "pick from list"
 * affordance AND lets them type a country that isn't in the curated list
 * (datalist's natural behaviour). Saves on blur, optimistic — same shape
 * as the rest of the card's inline-edit fields.
 */
function CountryInput({
  listId,
  value,
  placeholder,
  onSave,
}: {
  listId: string;
  value: string | null;
  placeholder: string;
  onSave: (next: string | null) => unknown;
}) {
  const [local, setLocal] = useState(value ?? '');
  // Re-sync from prop after a server rollback / sibling save revalidation.
  const [propRef, setPropRef] = useState(value ?? '');
  if ((value ?? '') !== propRef) {
    setPropRef(value ?? '');
    setLocal(value ?? '');
  }
  return (
    <input
      type="text"
      list={listId}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={(e) => {
        const next = e.target.value.trim();
        if (next === (value ?? '').trim()) return;
        onSave(next === '' ? null : next);
      }}
      placeholder={placeholder}
      className="h-8 w-36 px-2 rounded-md border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition"
    />
  );
}
