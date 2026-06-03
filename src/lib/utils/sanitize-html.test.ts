import { describe, expect, it } from 'vitest';

import { sanitizeRichTextHtml } from './sanitize-html';

describe('sanitizeRichTextHtml', () => {
  it('keeps allowed rich-text tags and strips unsafe markup', () => {
    const html = sanitizeRichTextHtml(`
      <p>Hello <strong>safe</strong></p>
      <script>alert(1)</script>
      <iframe src="https://example.com"></iframe>
      <a href="javascript:alert(1)" onclick="alert(2)">bad link</a>
      <a href="https://example.com" target="_self">good link</a>
    `);

    expect(html).toContain('<strong>safe</strong>');
    expect(html).toContain('bad link');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('target="_self"');
  });
});
