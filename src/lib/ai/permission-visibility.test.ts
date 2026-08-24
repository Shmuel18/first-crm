import { describe, expect, it } from 'vitest';

import { parseAiFeatures } from './flags';
import { filterInertAiPermissions, isAiPermissionInert } from './permission-visibility';

const allOff = parseAiFeatures({});
const inboxOn = parseAiFeatures({ enabled: true, modes: { email_triage: 'suggest' } });
const draftingOn = parseAiFeatures({ enabled: true, modes: { message_drafting: 'auto' } });

describe('isAiPermissionInert — a granted AI permission is only "real" while its feature is on', () => {
  it('every AI key is inert with the flags off (the dark-deploy case)', () => {
    expect(isAiPermissionInert('view_ai_inbox', allOff)).toBe(true);
    expect(isAiPermissionInert('use_ai_assistant', allOff)).toBe(true);
    expect(isAiPermissionInert('use_ai_queries', allOff)).toBe(true);
  });

  it('turning the feature on makes its key live again', () => {
    expect(isAiPermissionInert('view_ai_inbox', inboxOn)).toBe(false);
  });

  it('use_ai_assistant covers TWO features — either one keeps it live', () => {
    expect(isAiPermissionInert('use_ai_assistant', draftingOn)).toBe(false);
    // ...but an unrelated feature does not.
    expect(isAiPermissionInert('use_ai_assistant', inboxOn)).toBe(true);
  });

  it('the master kill switch overrides a per-feature mode', () => {
    const killed = parseAiFeatures({ enabled: false, modes: { email_triage: 'auto' } });
    expect(isAiPermissionInert('view_ai_inbox', killed)).toBe(true);
  });

  it('non-AI permissions are never touched', () => {
    expect(isAiPermissionInert('view_collections', allOff)).toBe(false);
    expect(isAiPermissionInert('create_case', allOff)).toBe(false);
  });
});

describe('filterInertAiPermissions — the roles editor shows no dead AI switches', () => {
  const permissions = [
    { key: 'create_case' },
    { key: 'view_ai_inbox' },
    { key: 'use_ai_assistant' },
    { key: 'use_ai_queries' },
  ];

  it('drops all three AI keys with the flags off, keeps the rest', () => {
    expect(filterInertAiPermissions(permissions, allOff)).toEqual([{ key: 'create_case' }]);
  });

  it('keeps the key whose feature is on', () => {
    expect(filterInertAiPermissions(permissions, inboxOn).map((p) => p.key)).toEqual([
      'create_case',
      'view_ai_inbox',
    ]);
  });
});
