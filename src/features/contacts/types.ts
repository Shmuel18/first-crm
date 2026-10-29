import type { Database } from '@/types/database';

export const CONTACT_KINDS = ['appraiser', 'lawyer', 'insurance_agent'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

type ContactRow = Database['public']['Tables']['professional_contacts']['Row'];

export type ProfessionalContact = Pick<
  ContactRow,
  'id' | 'name' | 'phone' | 'whatsapp' | 'email' | 'company' | 'notes'
> & { kind: ContactKind };

export function isContactKind(value: string): value is ContactKind {
  return (CONTACT_KINDS as readonly string[]).includes(value);
}
