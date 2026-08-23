import { describe, expect, it } from 'vitest';

import {
  collectAttachments,
  decodeBase64Url,
  extractTextBody,
  getHeader,
  parseFromHeader,
  type GmailPart,
} from './gmail-parsing';

function b64url(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

describe('parseFromHeader', () => {
  it('parses "Name <email>" including Hebrew names and quotes', () => {
    expect(parseFromHeader('משה לוי <Moshe@Gmail.com>')).toEqual({
      email: 'moshe@gmail.com',
      name: 'משה לוי',
    });
    expect(parseFromHeader('"Levi, Moshe" <m@l.co.il>')).toEqual({
      email: 'm@l.co.il',
      name: 'Levi, Moshe',
    });
  });

  it('bare address → lowercased email, null name; empty → empty email', () => {
    expect(parseFromHeader('A@B.com')).toEqual({ email: 'a@b.com', name: null });
    expect(parseFromHeader(null)).toEqual({ email: '', name: null });
  });
});

describe('getHeader / decodeBase64Url', () => {
  it('header lookup is case-insensitive', () => {
    expect(getHeader([{ name: 'SUBJECT', value: 'x' }], 'Subject')).toBe('x');
  });
  it('decodes base64url (Gmail flavor, no padding)', () => {
    expect(decodeBase64Url(b64url('שלום עולם')).toString('utf8')).toBe('שלום עולם');
  });
});

describe('extractTextBody', () => {
  it('prefers text/plain from nested multiparts and respects the cap', () => {
    const payload: GmailPart = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/html', body: { data: b64url('<b>HTML</b>') } },
        {
          mimeType: 'multipart/related',
          parts: [{ mimeType: 'text/plain', body: { data: b64url('טקסט פשוט ארוך מאוד') } }],
        },
      ],
    };
    expect(extractTextBody(payload, 9)).toBe('טקסט פשוט');
  });

  it('falls back to de-tagged HTML when no plain part exists', () => {
    const payload: GmailPart = {
      mimeType: 'text/html',
      body: { data: b64url('<p>שלום <b>משה</b>&nbsp;לוי</p><style>a{}</style>') },
    };
    expect(extractTextBody(payload, 100)).toBe('שלום משה לוי');
  });
});

describe('collectAttachments', () => {
  const payload: GmailPart = {
    mimeType: 'multipart/mixed',
    parts: [
      { mimeType: 'text/plain', body: { data: b64url('גוף') } },
      {
        filename: 'תלוש יוני.pdf',
        mimeType: 'application/pdf',
        body: { attachmentId: 'att-1', size: 250_000 },
      },
      {
        // Tiny inline signature image — must be flagged inline (filtered out).
        filename: 'logo.png',
        mimeType: 'image/png',
        headers: [{ name: 'Content-ID', value: '<sig@office>' }],
        body: { attachmentId: 'att-2', size: 8_000 },
      },
      {
        // Large photographed document without Content-ID — a real attachment.
        filename: 'צילום ת"ז.jpg',
        mimeType: 'image/jpeg',
        body: { attachmentId: 'att-3', size: 900_000 },
      },
    ],
  };

  it('collects real attachments and flags inline signatures', () => {
    const atts = collectAttachments(payload);
    expect(atts).toHaveLength(3);
    expect(atts.find((a) => a.attachmentId === 'att-1')).toMatchObject({ isInline: false });
    expect(atts.find((a) => a.attachmentId === 'att-2')).toMatchObject({ isInline: true });
    expect(atts.find((a) => a.attachmentId === 'att-3')).toMatchObject({ isInline: false });
  });

  it('small standalone images count as inline even without Content-ID', () => {
    const atts = collectAttachments({
      mimeType: 'multipart/mixed',
      parts: [
        {
          filename: 'banner.png',
          mimeType: 'image/png',
          body: { attachmentId: 'att-4', size: 20_000 },
        },
      ],
    });
    expect(atts[0]).toMatchObject({ isInline: true });
  });
});
