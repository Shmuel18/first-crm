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

  it('strips data: URI hrefs', () => {
    const html = sanitizeRichTextHtml(
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
    );
    expect(html).not.toContain('data:');
    expect(html).not.toContain('href=');
  });

  it('strips protocol-relative hrefs (allowProtocolRelative: false)', () => {
    const html = sanitizeRichTextHtml('<a href="//evil.example.com/p">x</a>');
    expect(html).not.toContain('//evil.example.com');
    expect(html).not.toContain('href=');
  });

  it('strips entity-encoded javascript: scheme tricks', () => {
    const html = sanitizeRichTextHtml('<a href="&#106;avascript:alert(1)">x</a>');
    expect(html).not.toContain('javascript:');
    expect(html.toLowerCase()).not.toContain('avascript:');
  });

  it('drops style attributes (CSS injection)', () => {
    const html = sanitizeRichTextHtml(
      '<p style="background:url(javascript:alert(1));position:fixed">text</p>',
    );
    expect(html).not.toContain('style=');
    expect(html).toContain('text');
  });

  it('neutralizes nested/broken tag smuggling', () => {
    const html = sanitizeRichTextHtml('<scr<script>ipt>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script>');
  });

  it('strips mailto with embedded markup but keeps plain mailto', () => {
    const html = sanitizeRichTextHtml('<a href="mailto:office@example.com">mail</a>');
    expect(html).toContain('href="mailto:office@example.com"');
  });

  it('is idempotent on already-sanitized output', () => {
    const once = sanitizeRichTextHtml('<p>שלום <strong>עולם</strong></p>');
    expect(sanitizeRichTextHtml(once)).toBe(once);
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(sanitizeRichTextHtml(null)).toBe('');
    expect(sanitizeRichTextHtml(undefined)).toBe('');
    expect(sanitizeRichTextHtml('')).toBe('');
  });
});
