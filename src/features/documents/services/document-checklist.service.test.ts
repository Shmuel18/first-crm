import { afterEach, describe, expect, it, vi } from 'vitest';

import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

import type { DocumentWithRelations } from '../types';
import { getCaseDocumentChecklist } from './document-checklist.service';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const CASE_ID = '10000000-0000-4000-8000-000000000001' as CaseId;
const CATEGORY_ID = '20000000-0000-4000-8000-000000000002';

function mockChecklist(
  overrides: Partial<{
    id: string;
    categoryId: string | null;
    categoryKey: string | null;
    nameHe: string | null;
    nameEn: string | null;
    label: string | null;
    driveFolder: string | null;
    isRequired: boolean;
    isDone: boolean;
    source: 'template' | 'manual';
    sortOrder: number;
    requiredAtStage: null;
  }> = {},
) {
  const data = [
    {
      id: 'checklist-item-1',
      categoryId: CATEGORY_ID,
      categoryKey: 'payslip',
      nameHe: 'תלוש שכר',
      nameEn: 'Payslip',
      label: null,
      driveFolder: 'income_il',
      isRequired: true,
      isDone: false,
      source: 'template' as const,
      sortOrder: 1,
      requiredAtStage: null,
      ...overrides,
    },
  ];
  vi.mocked(createClient).mockResolvedValue({
    rpc: vi.fn(async () => ({ data, error: null })),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

function document(status: 'new' | 'verified' | 'rejected'): DocumentWithRelations {
  return {
    id: `document-${status}`,
    status,
    category: { id: CATEGORY_ID },
  } as unknown as DocumentWithRelations;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('getCaseDocumentChecklist', () => {
  it('treats every filed document as immediately valid, including legacy statuses', async () => {
    mockChecklist();

    const [item] = await getCaseDocumentChecklist(CASE_ID, [
      document('new'),
      document('rejected'),
      document('verified'),
    ]);

    expect(item).toMatchObject({
      status: 'verified',
      uploadedCount: 3,
      validDocumentCount: 3,
    });
  });

  it('keeps an empty unticked requirement missing', async () => {
    mockChecklist();

    const [item] = await getCaseDocumentChecklist(CASE_ID, []);

    expect(item).toMatchObject({
      status: 'missing',
      uploadedCount: 0,
      validDocumentCount: 0,
    });
  });

  it('respects a manual received tick even when no document is linked', async () => {
    mockChecklist({ categoryId: null, categoryKey: null, source: 'manual', isDone: true });

    const [item] = await getCaseDocumentChecklist(CASE_ID, []);

    expect(item).toMatchObject({ status: 'verified', isDone: true, validDocumentCount: 0 });
  });
});
