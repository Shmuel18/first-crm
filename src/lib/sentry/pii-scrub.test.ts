import { describe, expect, it } from 'vitest';

import { scrubDeep, scrubString, sentryBeforeSend } from './pii-scrub';

import type { ErrorEvent } from '@sentry/nextjs';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig-part-here';

describe('scrubString', () => {
  it('masks Israeli national IDs, emails, phones, and tokens', () => {
    expect(scrubString('id 123456789 done')).toBe('id ID:1*** done');
    expect(scrubString('mail a.user@example.com')).toBe('mail [redacted]@example.com');
    expect(scrubString('call 0501234567')).toBe('call phone:***4567');
    expect(scrubString(`tok ${JWT}`)).toBe('tok TOKEN:[redacted]');
    expect(scrubString('password=hunter2&x=1')).toBe('redacted=[redacted]&x=1');
  });
});

describe('scrubDeep', () => {
  it('walks nested objects/arrays and drops secret-bearing keys', () => {
    const out = scrubDeep({
      list: ['123456789', { email: 'a@b.co.il' }],
      password: 'hunter2',
      cookie: 'session=abc',
      note: 'fine',
    }) as Record<string, unknown>;
    expect(out.password).toBe('[redacted-header]');
    expect(out.cookie).toBe('[redacted-header]');
    expect(out.note).toBe('fine');
    const list = out.list as unknown[];
    expect(list[0]).toBe('ID:1***');
    expect((list[1] as Record<string, unknown>).email).toBe('[redacted]@b.co.il');
  });
});

describe('sentryBeforeSend', () => {
  it('scrubs the request body (event.request.data)', () => {
    // Partial fixture cast: tests only need the request subtree.
    const event = {
      request: {
        data: { id_number: '123456789', email: 'a@b.com', password: 'hunter2' },
      },
    } as unknown as ErrorEvent;

    const out = sentryBeforeSend(event);
    const data = (out?.request?.data ?? {}) as Record<string, unknown>;
    expect(data.id_number).toBe('ID:1***');
    expect(data.email).toBe('[redacted]@b.com');
    expect(data.password).toBe('[redacted-header]');
  });

  it('scrubs stack-frame local variables (frames[].vars)', () => {
    const event = {
      exception: {
        values: [
          {
            value: 'boom for a@b.com',
            stacktrace: {
              frames: [{ vars: { idNumber: '123456789', token: JWT } }],
            },
          },
        ],
      },
    } as unknown as ErrorEvent;

    const out = sentryBeforeSend(event);
    const value = out?.exception?.values?.[0];
    expect(value?.value).toBe('boom for [redacted]@b.com');
    const vars = (value?.stacktrace?.frames?.[0]?.vars ?? {}) as Record<string, unknown>;
    expect(vars.idNumber).toBe('ID:1***');
    expect(vars.token).toBe('TOKEN:[redacted]');
  });

  it('scrubs non-string query_string shapes (array of pairs)', () => {
    const event = {
      request: {
        query_string: [
          ['email', 'a@b.com'],
          ['id', '123456789'],
        ],
      },
    } as unknown as ErrorEvent;

    const out = sentryBeforeSend(event);
    const qs = out?.request?.query_string as unknown as string[][];
    expect(qs[0]?.[1]).toBe('[redacted]@b.com');
    expect(qs[1]?.[1]).toBe('ID:1***');
  });

  it('still scrubs string query_string and redacts cookies + user', () => {
    const event = {
      request: {
        query_string: 'email=a@b.com',
        cookies: { session: 'abc' },
      },
      user: { id: 'uid-1', email: 'a@b.com' },
    } as unknown as ErrorEvent;

    const out = sentryBeforeSend(event);
    expect(out?.request?.query_string).toBe('email=[redacted]@b.com');
    expect(out?.request?.cookies).toBe('[redacted-cookies]');
    expect(out?.user).toEqual({ id: 'uid-1' });
  });
});
