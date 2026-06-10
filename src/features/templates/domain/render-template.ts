import { TEMPLATE_VARIABLES, type TemplateVariable } from '../types';

export type TemplateContext = Readonly<Record<TemplateVariable, string>>;

const VARIABLE_PATTERN = new RegExp(`\\{(${TEMPLATE_VARIABLES.join('|')})\\}`, 'g');

/**
 * Substitutes `{merge_field}` placeholders with their per-case values.
 * Unknown braces are left untouched so a typo'd field stays visible to the
 * advisor instead of silently disappearing from the message.
 */
export function renderTemplate(text: string, context: TemplateContext): string {
  return text.replace(VARIABLE_PATTERN, (_, key: string) => context[key as TemplateVariable]);
}
