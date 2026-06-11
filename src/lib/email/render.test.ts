import { describe, expect, it } from 'vitest';

import { escapeHtml, renderBrandedEmail } from './render';

describe('escapeHtml', () => {
  it('escapes markup-significant characters', () => {
    expect(escapeHtml('<b>&"x"</b>')).toBe('&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
  });
});

describe('renderBrandedEmail', () => {
  const base = {
    locale: 'en' as const,
    heading: 'Hello',
    bodyHtml: '<p>ok</p>',
    footer: 'footer text',
  };

  it('escapes the heading and footer', () => {
    const html = renderBrandedEmail({
      ...base,
      heading: '<script>x</script>',
      footer: '<img src=x>',
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img src=x>');
  });

  it('keeps an https CTA link', () => {
    const html = renderBrandedEmail({
      ...base,
      cta: { label: 'Open', url: 'https://crm.example.com/cases/1' },
    });
    expect(html).toContain('href="https://crm.example.com/cases/1"');
    expect(html).toContain('Open');
  });

  it('drops a CTA with a javascript: URL entirely', () => {
    const html = renderBrandedEmail({
      ...base,
      cta: { label: 'Open', url: 'javascript:alert(1)' },
    });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('Open');
  });

  it('drops data: and protocol-relative CTA URLs', () => {
    for (const url of ['data:text/html,x', '//evil.example.com/x']) {
      const html = renderBrandedEmail({ ...base, cta: { label: 'Go', url } });
      expect(html).not.toContain('data:text/html');
      expect(html).not.toContain('//evil.example.com');
    }
  });

  it('renders RTL direction for Hebrew', () => {
    const html = renderBrandedEmail({ ...base, locale: 'he' });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="he"');
  });
});
