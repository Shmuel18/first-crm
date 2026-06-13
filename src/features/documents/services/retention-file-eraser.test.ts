import { afterEach, describe, expect, it, vi } from 'vitest';

import { isRetentionPurgeEnabled } from '@/features/documents/services/erasure-freshness.service';
import { createAdminClient } from '@/lib/supabase/admin';

import { eraseRetiredFiles } from './retention-file-eraser';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/features/documents/services/erasure-freshness.service', () => ({
  isRetentionPurgeEnabled: vi.fn(),
}));
vi.mock('@/features/integrations/services/drive-case-uploader', () => ({ eraseDriveTargets: vi.fn() }));
vi.mock('@/features/documents/services/documents.service', () => ({ DOCUMENTS_BUCKET: 'case-documents' }));

afterEach(() => vi.clearAllMocks());

describe('eraseRetiredFiles — retention switch (R4-legal-5)', () => {
  it('returns paused and touches NOTHING (no DB/Storage/Drive) when the switch is off', async () => {
    vi.mocked(isRetentionPurgeEnabled).mockResolvedValue(false);

    const res = await eraseRetiredFiles();

    expect(res).toEqual({ ok: true, paused: true });
    // Gated before any admin client is created → no Storage remove, no pointer null.
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
