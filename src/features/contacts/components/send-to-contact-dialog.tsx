'use client';

import { useState } from 'react';

import { Mail, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { NativeSelect } from '@/components/shared/form-fields';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { buildWhatsAppLink } from '@/features/borrowers/domain/contact-links';
import { logWhatsAppSendAction } from '@/features/case-activity/actions/log-whatsapp-send';
import { callAction } from '@/lib/actions/call-action';
import { SendDocumentsEmailDialog } from '@/features/documents/components/send-documents-email-dialog';

import {
  buildContactMessage,
  CONTACT_MESSAGE_FIELDS,
  defaultFieldsFor,
  type ContactCaseDetails,
  type ContactMessageField,
} from '../domain/contact-message';
import type { ContactKind, ProfessionalContact } from '../types';

type Props = {
  caseId: string;
  kind: ContactKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The directory's contacts of this kind. */
  contacts: ReadonlyArray<ProfessionalContact>;
  /** The name already on the case — preselects the matching contact. */
  currentName: string | null;
  details: ContactCaseDetails;
  /** Fills the case's field when it is still empty and a contact is sent to. */
  onPickName: (name: string) => void;
};

/**
 * Send the case details to an appraiser / lawyer / insurance agent: pick the
 * contact, tick what to include, edit the text, then WhatsApp it or email it
 * (the email path is the documents mailer, so case files can be attached and
 * the send lands in the case's email log).
 */
export function SendToContactDialog(props: Props) {
  const { caseId, kind, open, onOpenChange, contacts, currentName, details, onPickName } = props;
  const t = useTranslations('contacts.send');
  const tf = useTranslations('contacts.messageFields');
  const matched = contacts.find((c) => c.name.trim() === currentName?.trim());
  const [contactId, setContactId] = useState(matched?.id ?? contacts[0]?.id ?? '');
  const [fields, setFields] = useState<ContactMessageField[]>(() => defaultFieldsFor(kind));
  const [edited, setEdited] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const contact = contacts.find((c) => c.id === contactId) ?? null;

  const labels = Object.fromEntries(CONTACT_MESSAGE_FIELDS.map((f) => [f, tf(f)])) as Record<
    ContactMessageField,
    string
  >; // fromEntries loses the key type; every field is mapped above
  const built = buildContactMessage({
    greeting: t('greeting', { name: contact?.name ?? '' }),
    intro: t(`intro.${kind}`),
    closing: t('closing'),
    fields,
    details,
    labels,
  });
  const message = edited ?? built;
  const whatsapp = contact ? buildWhatsAppLink(contact.whatsapp ?? contact.phone, message) : null;

  const toggle = (f: ContactMessageField): void => {
    setEdited(null);
    setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };
  const noteSent = (): void => {
    if (contact && !currentName?.trim()) onPickName(contact.name);
  };

  return (
    <>
      <Dialog open={open && !emailOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t(`title.${kind}`)}</DialogTitle>
            <DialogDescription>{t('subtitle')}</DialogDescription>
          </DialogHeader>
          <NativeSelect
            value={contactId}
            onChange={(e) => {
              setContactId(e.target.value);
              setEdited(null);
            }}
            aria-label={t('contactLabel')}
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <fieldset className="flex flex-wrap gap-x-4 gap-y-1.5">
            <legend className="mb-1 text-xs font-medium text-neutral-600">{t('include')}</legend>
            {CONTACT_MESSAGE_FIELDS.filter((f) => details[f]).map((f) => (
              <label key={f} className="flex items-center gap-1.5 text-xs text-neutral-700">
                <input type="checkbox" checked={fields.includes(f)} onChange={() => toggle(f)} />
                {labels[f]}
              </label>
            ))}
          </fieldset>
          <Textarea
            value={message}
            onChange={(e) => setEdited(e.target.value)}
            rows={9}
            aria-label={t('messageLabel')}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!contact?.email}
              onClick={() => setEmailOpen(true)}
            >
              <Mail className="size-4" aria-hidden="true" />
              {t('viaEmail')}
            </Button>
            <Button
              type="button"
              disabled={!whatsapp}
              onClick={() => {
                if (!whatsapp || !contact) return;
                window.open(whatsapp, '_blank', 'noopener,noreferrer');
                void callAction(() =>
                  logWhatsAppSendAction({
                    caseId,
                    kind: 'professional_message',
                    recipientName: contact.name,
                    phone: contact.whatsapp ?? contact.phone ?? '',
                    body: message,
                  }),
                );
                noteSent();
                onOpenChange(false);
              }}
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              {t('viaWhatsapp')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {emailOpen && contact && (
        <SendDocumentsEmailDialog
          caseId={caseId}
          open={emailOpen}
          onOpenChange={(next) => {
            setEmailOpen(next);
            if (!next) {
              noteSent();
              onOpenChange(false);
            }
          }}
          defaultRecipient={contact.email}
          initialAttachments={[]}
          initialSubject={t('emailSubject', { client: details.clientName ?? '' })}
          initialBody={message}
        />
      )}
    </>
  );
}
