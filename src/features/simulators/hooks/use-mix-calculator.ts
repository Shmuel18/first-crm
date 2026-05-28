'use client';

import { useMemo, useState } from 'react';

import { DEFAULT_REGULATORY_THRESHOLDS } from '../constants';
import { aggregateMix } from '../domain/mix-aggregate';
import { validateMix } from '../domain/regulatory-rules';
import type { MixInput, PropertyKind, RegulatoryThresholds, TrackInput } from '../types';
import { newTrack, normalizeTrack, remainingAmount } from '../utils/track-factory';

type Params = {
  initialInput?: MixInput;
  initialPropertyKind?: PropertyKind;
  thresholds?: RegulatoryThresholds;
};

const DEFAULT_MIX: MixInput = {
  mortgageAmount: 800_000_00,
  propertyValue: 1_200_000_00,
  equity: 400_000_00,
  defaultTermMonths: 360,
  tracks: [
    newTrack('fixed_unlinked', 270_000_00, 4.5),
    newTrack('prime', 260_000_00, 6.0),
    newTrack('variable_linked', 270_000_00, 4.2, 2.5),
  ],
};

export function useMixCalculator({
  initialInput,
  initialPropertyKind = 'first_home',
  thresholds = DEFAULT_REGULATORY_THRESHOLDS,
}: Params) {
  const [title, setTitle] = useState('');
  const [advisorConclusion, setAdvisorConclusion] = useState('');
  const [propertyKind, setPropertyKind] = useState<PropertyKind>(initialPropertyKind);
  const [mix, setMix] = useState<MixInput>(initialInput ?? DEFAULT_MIX);
  const result = useMemo(() => aggregateMix(mix), [mix]);
  const violations = useMemo(
    () => validateMix(mix, thresholds, propertyKind),
    [mix, propertyKind, thresholds],
  );

  const setMoney = (field: 'mortgageAmount' | 'propertyValue' | 'equity', value: number) =>
    setMix((current) => ({ ...current, [field]: value }));
  const setTermMonths = (value: number) =>
    setMix((current) => ({ ...current, defaultTermMonths: value }));
  const updateTrack = (id: string, patch: Partial<TrackInput>) =>
    setMix((current) => ({
      ...current,
      tracks: current.tracks.map((track) =>
        track.id === id ? normalizeTrack({ ...track, ...patch }) : track,
      ),
    }));
  const addTrack = () =>
    setMix((current) => ({
      ...current,
      tracks: [...current.tracks, newTrack('fixed_unlinked', remainingAmount(current.mortgageAmount, current.tracks), 4.5)],
    }));
  const removeTrack = (id: string) =>
    setMix((current) => ({
      ...current,
      tracks: current.tracks.length === 1 ? current.tracks : current.tracks.filter((t) => t.id !== id),
    }));

  return {
    title,
    setTitle,
    advisorConclusion,
    setAdvisorConclusion,
    propertyKind,
    setPropertyKind,
    mix,
    setMoney,
    setTermMonths,
    updateTrack,
    addTrack,
    removeTrack,
    result,
    violations,
  };
}
