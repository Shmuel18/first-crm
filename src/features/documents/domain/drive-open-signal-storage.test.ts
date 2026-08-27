import { afterEach, describe, expect, it, vi } from 'vitest';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Drive-open signal session persistence', () => {
  it('survives a page reload in the same tab', async () => {
    const sessionStorage = memoryStorage();
    vi.stubGlobal('window', { sessionStorage });

    const beforeReload = await import('./drive-open-signal');
    const version = beforeReload.markDriveOpened('case-a');

    vi.resetModules();
    const afterReload = await import('./drive-open-signal');
    expect(afterReload.pendingDriveSyncVersion('case-a')).toBeNull();
    expect(afterReload.requestDriveSyncAfterReturn('case-a')).toBe(version);
    expect(afterReload.acknowledgeDriveSync('case-a', version)).toBe(true);
    expect(sessionStorage.length).toBe(0);
  });
});
