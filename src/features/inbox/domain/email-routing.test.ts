import { describe, expect, it } from 'vitest';

import { routeEmail, TRIAGE_MIN_CONFIDENCE } from './email-routing';

const base = {
  contentKind: 'client_correspondence' as const,
  senderMatchedCases: 0,
  docAttachmentsCount: 0,
  confidence: 0.9,
  mode: 'auto' as const,
};

describe('routeEmail — facts outrank the model', () => {
  it('one matched case + attachments → client_documents, ingested, auto_processed', () => {
    const r = routeEmail({ ...base, senderMatchedCases: 1, docAttachmentsCount: 2 });
    expect(r).toEqual({ category: 'client_documents', status: 'auto_processed', ingestAttachments: true });
  });

  it('one matched case, no attachments → client_message awaiting the advisor', () => {
    const r = routeEmail({ ...base, senderMatchedCases: 1 });
    expect(r.category).toBe('client_message');
    expect(r.status).toBe('new');
    expect(r.ingestAttachments).toBe(false);
  });

  it('address on SEVERAL active cases → never guesses, escalates', () => {
    const r = routeEmail({ ...base, senderMatchedCases: 3, docAttachmentsCount: 2 });
    expect(r.category).toBe('probable_client');
    expect(r.status).toBe('needs_review');
    expect(r.ingestAttachments).toBe(false);
  });

  it('sender match wins even when the model calls it marketing', () => {
    const r = routeEmail({ ...base, contentKind: 'vendor_or_marketing', senderMatchedCases: 1 });
    expect(r.category).toBe('client_message');
  });
});

describe('routeEmail — unknown senders', () => {
  it('reads like a client but no address match → human queue', () => {
    const r = routeEmail({ ...base });
    expect(r.category).toBe('probable_client');
    expect(r.status).toBe('needs_review');
  });

  it('bank mail escalates to the queue', () => {
    const r = routeEmail({ ...base, contentKind: 'bank' });
    expect(r).toMatchObject({ category: 'bank', status: 'needs_review' });
  });

  it('marketing/internal are logged silently', () => {
    expect(routeEmail({ ...base, contentKind: 'vendor_or_marketing' }).status).toBe('auto_processed');
    expect(routeEmail({ ...base, contentKind: 'internal' }).status).toBe('auto_processed');
  });

  it('low confidence collapses ANY kind to unclear → הקפצה', () => {
    const r = routeEmail({
      ...base,
      contentKind: 'vendor_or_marketing',
      confidence: TRIAGE_MIN_CONFIDENCE - 0.01,
    });
    expect(r.category).toBe('unclear');
    expect(r.status).toBe('needs_review');
  });
});

describe('routeEmail — shadow mode never touches documents', () => {
  it('client_documents in shadow: categorized but nothing ingested', () => {
    const r = routeEmail({ ...base, senderMatchedCases: 1, docAttachmentsCount: 2, mode: 'shadow' });
    expect(r.category).toBe('client_documents');
    expect(r.ingestAttachments).toBe(false);
  });
});
