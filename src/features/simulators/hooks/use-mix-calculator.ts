'use client';

import { useMemo, useState } from 'react';

import { DEFAULT_REGULATORY_THRESHOLDS } from '../constants';
import { aggregateMix } from '../domain/mix-aggregate';
import { composeMixByFamily, type CompositionSlice } from '../domain/mix-composition';
import { rateExposure, type MixExposure } from '../domain/mix-exposure';
import { validateMix } from '../domain/regulatory-rules';
import type {
  MixInput,
  MixResult,
  PropertyKind,
  RegulatoryThresholds,
  RegulatoryViolation,
  TrackInput,
} from '../types';
import {
  buildUniformBasket,
  newTrack,
  normalizeTrack,
  remainingAmount,
  type UniformBasketKind,
} from '../utils/track-factory';

type Params = {
  initialInput?: MixInput;
  initialPropertyKind?: PropertyKind;
  initialTitle?: string;
  initialConclusion?: string;
  thresholds?: RegulatoryThresholds;
};

export interface UseMixCalculatorResult {
  title: string;
  setTitle: (value: string) => void;
  advisorConclusion: string;
  setAdvisorConclusion: (value: string) => void;
  propertyKind: PropertyKind;
  setPropertyKind: (value: PropertyKind) => void;
  mix: MixInput;
  setMoney: (field: 'mortgageAmount' | 'propertyValue' | 'equity', value: number) => void;
  setTermMonths: (value: number) => void;
  updateTrack: (id: string, patch: Partial<TrackInput>) => void;
  addTrack: () => void;
  removeTrack: (id: string) => void;
  loadBasket: (kind: UniformBasketKind) => void;
  result: MixResult;
  violations: ReadonlyArray<RegulatoryViolation>;
  composition: ReadonlyArray<CompositionSlice>;
  exposure: MixExposure;
}

// Rates are the all-in annual rate per track (what the borrower actually pays).
// Prime is entered directly (≈ BoI base + 1.5% ± the bank's margin), not derived.
const DEFAULT_MIX: MixInput = {
  mortgageAmount: 800_000_00,
  propertyValue: 1_200_000_00,
  equity: 400_000_00,
  defaultTermMonths: 360,
  tracks: [
    newTrack('fixed_unlinked', 270_000_00, 4.9),
    newTrack('prime', 260_000_00, 6),
    newTrack('variable_linked', 270_000_00, 3.5, 2),
  ],
};

export function useMixCalculator({
  initialInput,
  initialPropertyKind = 'first_home',
  initialTitle = '',
  initialConclusion = '',
  thresholds = DEFAULT_REGULATORY_THRESHOLDS,
}: Params): UseMixCalculatorResult {
  const [title, setTitle] = useState(initialTitle);
  const [advisorConclusion, setAdvisorConclusion] = useState(initialConclusion);
  const [propertyKind, setPropertyKind] = useState<PropertyKind>(initialPropertyKind);
  const [mix, setMix] = useState<MixInput>(initialInput ?? DEFAULT_MIX);
  const result = useMemo(() => aggregateMix(mix), [mix]);
  const violations = useMemo(
    () => validateMix(mix, thresholds, propertyKind),
    [mix, propertyKind, thresholds],
  );
  const composition = useMemo(() => composeMixByFamily(mix.tracks), [mix.tracks]);
  const exposure = useMemo(() => rateExposure(composition), [composition]);

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
  const loadBasket = (kind: UniformBasketKind) =>
    setMix((current) => ({
      ...current,
      tracks: buildUniformBasket(kind, current.mortgageAmount, current.defaultTermMonths),
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
    loadBasket,
    result,
    violations,
    composition,
    exposure,
  };
}
