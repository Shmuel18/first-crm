import { buildTrackSchedule } from './track-payment';
import { summarizeTrack } from './track-summary';

import type { TrackInput, TrackResult } from '../types';

export function calculateMonthlyPayment(track: TrackInput): TrackResult {
  return summarizeTrack(track.id, buildTrackSchedule(track), track.amount);
}
