import { buildBalloonSchedule } from './amortization-balloon';
import { buildEqualPrincipalSchedule } from './amortization-equal-principal';
import { buildSpitzerSchedule } from './amortization-spitzer';

import type { AmortizationRow, TrackInput } from '../types';

export function buildTrackSchedule(track: TrackInput): ReadonlyArray<AmortizationRow> {
  if (track.repayment === 'equal_principal') return buildEqualPrincipalSchedule(track);
  if (track.repayment === 'balloon') return buildBalloonSchedule(track);
  return buildSpitzerSchedule(track);
}

