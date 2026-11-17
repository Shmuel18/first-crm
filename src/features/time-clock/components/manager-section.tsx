'use client';

import { useState } from 'react';

import type { Locale } from '@/lib/i18n/direction';

import type { BoardRow, TrackedEmployee } from '../types';
import { ManagerPanel } from './manager-panel';
import { ManagerTimesheet } from './manager-timesheet';

/**
 * Manager surface: the live board + tracking/wage settings, plus the timesheet.
 * A tracking or rate change in the settings bumps a version the timesheet keys
 * its fetch on, so its hours/₪ update instantly — no page refresh needed.
 */
export function ManagerSection({
  board,
  staff,
  locale,
  readOnly = false,
}: {
  board: BoardRow[];
  staff: TrackedEmployee[];
  locale: Locale;
  /** Attendance viewer (mig 259): see hours, change nothing. */
  readOnly?: boolean;
}) {
  const [version, setVersion] = useState(0);
  return (
    <>
      <ManagerPanel
        board={board}
        staff={staff}
        locale={locale}
        readOnly={readOnly}
        onChanged={() => setVersion((v) => v + 1)}
      />
      <ManagerTimesheet locale={locale} refreshKey={version} readOnly={readOnly} />
    </>
  );
}
