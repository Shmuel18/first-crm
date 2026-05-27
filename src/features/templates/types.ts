export const TEMPLATE_CHANNELS = ['whatsapp', 'email', 'general'] as const;
export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number];

/** Merge fields that can be inserted into a template body (substituted at send time). */
export const TEMPLATE_VARIABLES = [
  'client_name',
  'case_number',
  'advisor_name',
  'office_name',
  'date',
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

/**
 * message_templates is created in migration 035 and isn't in the generated
 * Database types yet, so the shape is declared here (kept in sync with the table).
 */
export type MessageTemplate = {
  id: string;
  name: string;
  channel: TemplateChannel;
  subject: string | null;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type TemplateActionState =
  | { ok: true; templateId: string }
  | {
      ok: false;
      error: 'idle' | 'validation' | 'unauthorized' | 'not_found' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    };

export const TEMPLATE_ACTION_INITIAL: TemplateActionState = { ok: false, error: 'idle' };
