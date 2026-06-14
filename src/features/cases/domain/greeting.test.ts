import { describe, expect, it } from 'vitest';

import { getGreetingKey } from './greeting';

describe('getGreetingKey', () => {
  it('maps the (Israel wall-clock) hour to the right greeting at each boundary', () => {
    expect(getGreetingKey(0)).toBe('morning');
    expect(getGreetingKey(11)).toBe('morning');
    expect(getGreetingKey(12)).toBe('afternoon');
    expect(getGreetingKey(17)).toBe('afternoon');
    expect(getGreetingKey(18)).toBe('evening');
    expect(getGreetingKey(21)).toBe('evening');
    expect(getGreetingKey(22)).toBe('night');
    expect(getGreetingKey(23)).toBe('night');
  });
});
