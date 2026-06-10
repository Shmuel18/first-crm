import { describe, expect, it } from 'vitest';

import {
  SYSTEM_EMAIL_TEMPLATE_DEFINITIONS,
  SYSTEM_EMAIL_TEMPLATE_KEYS,
  renderSystemTemplateText,
} from './system-email-templates';

describe('system email templates', () => {
  it('has bilingual defaults for every registered template', () => {
    for (const key of SYSTEM_EMAIL_TEMPLATE_KEYS) {
      const definition = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS[key];
      expect(definition.defaults.he.subject).not.toBe('');
      expect(definition.defaults.en.subject).not.toBe('');
      expect(definition.defaults.he.body).not.toBe('');
      expect(definition.defaults.en.body).not.toBe('');
    }
  });

  it('substitutes supplied variables and leaves unknown variables visible', () => {
    expect(renderSystemTemplateText('Hi {name}, open {missing}.', { name: 'Dana' })).toBe(
      'Hi Dana, open {missing}.',
    );
  });

  it('marks security messages as critical', () => {
    expect(SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.invite.critical).toBe(true);
    expect(SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.password_reset.critical).toBe(true);
  });
});
