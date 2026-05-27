'use client';

import { Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DraftLockedBlock } from './draft-locked-block';

/**
 * Admin/office data needs a persisted case id, audit context, and child rows.
 * In draft mode it should look like the live block chrome but stay collapsed.
 */
export function DraftAdminBlock() {
  const tBlocks = useTranslations('case.blocks');

  return <DraftLockedBlock title={tBlocks('admin')} icon={<Wallet />} fullWidth />;
}
