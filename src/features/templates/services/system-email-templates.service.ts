import type { SupabaseClient } from '@supabase/supabase-js';

import { escapeHtml, renderBrandedEmail } from '@/lib/email/render';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import {
  SYSTEM_EMAIL_TEMPLATE_DEFINITIONS,
  SYSTEM_EMAIL_TEMPLATE_KEYS,
  renderSystemTemplateText,
  type SystemEmailTemplateKey,
  type SystemEmailTemplateLocale,
} from '../domain/system-email-templates';

type SystemTemplateOverride = {
  template_key: SystemEmailTemplateKey;
  locale: SystemEmailTemplateLocale;
  subject: string;
  heading: string;
  body: string;
  cta_label: string;
  is_enabled: boolean;
};

export type ResolvedSystemEmailTemplate = {
  key: SystemEmailTemplateKey;
  locale: SystemEmailTemplateLocale;
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  isEnabled: boolean;
  isCustomized: boolean;
};

export type SystemEmailTemplateSummary = {
  key: SystemEmailTemplateKey;
  category: (typeof SYSTEM_EMAIL_TEMPLATE_DEFINITIONS)[SystemEmailTemplateKey]['category'];
  critical: boolean;
  variables: readonly string[];
  versions: Record<SystemEmailTemplateLocale, ResolvedSystemEmailTemplate>;
};

const SYSTEM_TEMPLATE_COLUMNS =
  'template_key, locale, subject, heading, body, cta_label, is_enabled' as const;

export async function listSystemEmailTemplates(): Promise<SystemEmailTemplateSummary[]> {
  const supabase = await createClient();
  const { data } = await (supabase as unknown as SupabaseClient)
    .from('system_email_templates')
    .select(SYSTEM_TEMPLATE_COLUMNS);
  const overrides = (data ?? []) as SystemTemplateOverride[];

  return SYSTEM_EMAIL_TEMPLATE_KEYS.map((key) => {
    const definition = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS[key];
    return {
      key,
      category: definition.category,
      critical: definition.critical,
      variables: definition.variables,
      versions: {
        he: resolveVersion(key, 'he', overrides.find((row) => row.template_key === key && row.locale === 'he')),
        en: resolveVersion(key, 'en', overrides.find((row) => row.template_key === key && row.locale === 'en')),
      },
    };
  });
}

export async function resolveSystemEmailTemplate(
  key: SystemEmailTemplateKey,
  locale: SystemEmailTemplateLocale,
  variables: Readonly<Record<string, string | number>> = {},
): Promise<ResolvedSystemEmailTemplate> {
  let override: SystemTemplateOverride | undefined;
  try {
    const admin = createAdminClient();
    const { data } = await (admin as unknown as SupabaseClient)
      .from('system_email_templates')
      .select(SYSTEM_TEMPLATE_COLUMNS)
      .eq('template_key', key)
      .eq('locale', locale)
      .maybeSingle();
    override = (data ?? undefined) as SystemTemplateOverride | undefined;
  } catch {
    // Defaults keep transactional mail working before/without the migration.
  }

  const resolved = resolveVersion(key, locale, override);
  return {
    ...resolved,
    subject: renderSystemTemplateText(resolved.subject, variables),
    heading: renderSystemTemplateText(resolved.heading, variables),
    body: renderSystemTemplateText(resolved.body, variables),
    ctaLabel: renderSystemTemplateText(resolved.ctaLabel, variables),
  };
}

export async function renderSystemEmail(input: {
  key: SystemEmailTemplateKey;
  locale: SystemEmailTemplateLocale;
  variables?: Readonly<Record<string, string | number>>;
  ctaUrl: string;
  footer: string;
  afterBodyHtml?: string;
}): Promise<{ enabled: boolean; subject: string; html: string }> {
  const template = await resolveSystemEmailTemplate(input.key, input.locale, input.variables);
  if (!template.isEnabled) return { enabled: false, subject: template.subject, html: '' };

  return {
    enabled: true,
    subject: template.subject,
    html: renderBrandedEmail({
      locale: input.locale,
      heading: template.heading,
      bodyHtml: `${plainTextBodyHtml(template.body)}${input.afterBodyHtml ?? ''}`,
      cta: { label: template.ctaLabel, url: input.ctaUrl },
      footer: input.footer,
    }),
  };
}

export function plainTextBodyHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 12px;">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
    )
    .join('');
}

function resolveVersion(
  key: SystemEmailTemplateKey,
  locale: SystemEmailTemplateLocale,
  override?: SystemTemplateOverride,
): ResolvedSystemEmailTemplate {
  const definition = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS[key];
  const defaults = definition.defaults[locale];
  return {
    key,
    locale,
    subject: override?.subject ?? defaults.subject,
    heading: override?.heading ?? defaults.heading,
    body: override?.body ?? defaults.body,
    ctaLabel: override?.cta_label ?? defaults.ctaLabel,
    isEnabled: definition.critical ? true : (override?.is_enabled ?? true),
    isCustomized: Boolean(override),
  };
}
