'use client';

import { CaseBlock } from './case-block';

/**
 * Thin wrapper that renders the same chrome as a live case-page block, with
 * placeholder content as children. The block looks identical to a real-but-
 * empty case-detail block — no opacity, no lock icon, no "save first" footer.
 * The user knows they're on a draft from the gold action bar at the top
 * ("תיק חדש · טרם נשמר"); inside the page everything reads as a regular
 * empty case.
 */

type Props = {
  title: string;
  icon: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
};

export function DraftLockedBlock({ title, icon, fullWidth, children }: Props) {
  return (
    <CaseBlock title={title} icon={icon} fullWidth={fullWidth}>
      {children}
    </CaseBlock>
  );
}
