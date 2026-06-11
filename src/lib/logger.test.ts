import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from './logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger PII redaction', () => {
  it('drops TOP-LEVEL secret-named fields (password) and masks PII values', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('login failed', {
      password: 'Secret123',
      email: 'a.user@gmail.com',
      idNumber: '123456789',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]?.[0]);
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.password).toBe('[redacted-header]');
    expect(parsed.email).toBe('[redacted]@gmail.com');
    expect(parsed.idNumber).toBe('ID:1***');
    expect(line).not.toContain('Secret123');
  });

  it('scrubs nested objects too', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warn('ctx', { meta: { authorization: 'Bearer abcdef123456', phone: '0501234567' } });

    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).not.toContain('abcdef123456');
    expect(line).not.toContain('0501234567');
  });
});
