'use client';

import { useState } from 'react';

import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EditableField, type SaveResult } from '@/features/borrowers/components/editable-field';

import type { ContactCaseDetails } from '../domain/contact-message';
import type { ContactKind, ProfessionalContact } from '../types';

import { SendToContactDialog } from './send-to-contact-dialog';

type Props = {
  caseId: string;
  kind: ContactKind;
  label: string;
  value: string | null;
  onSave: (next: string | null) => Promise<SaveResult>;
  canEdit: boolean;
  /** Whole directory; filtered to this kind here. */
  contacts: ReadonlyArray<ProfessionalContact>;
  details: ContactCaseDetails;
};

/**
 * A case's appraiser / lawyer / insurance-agent name: free text that suggests
 * the office's directory as you type, plus a send button that mails or
 * WhatsApps that professional the case details.
 */
export function ContactField({ caseId, kind, label, value, onSave, canEdit, contacts, details }: Props) {
  const t = useTranslations('contacts.send');
  const [open, setOpen] = useState(false);
  const ofKind = contacts.filter((c) => c.kind === kind);

  return (
    <>
      <EditableField
        label={label}
        value={value}
        onSave={onSave}
        canEdit={canEdit}
        suggestions={ofKind.map((c) => c.name)}
        adornment={
          ofKind.length > 0 ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t(`title.${kind}`)}
              title={t(`title.${kind}`)}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition hover:bg-brand-gold-soft hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          ) : null
        }
      />
      {open && (
        <SendToContactDialog
          caseId={caseId}
          kind={kind}
          open={open}
          onOpenChange={setOpen}
          contacts={ofKind}
          currentName={value}
          details={details}
          onPickName={(name) => {
            if (canEdit) void onSave(name);
          }}
        />
      )}
    </>
  );
}
