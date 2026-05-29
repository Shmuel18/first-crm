'use client';

import { useMemo, useState } from 'react';

import { SCENARIO_PRESETS } from '../constants';
import { stressMix, type StressResult, type StressScenario } from '../domain/scenario-stress';
import type { MixInput, PropertyKind, ScenarioPresetKey, TrackInput } from '../types';
import { newTrack, normalizeTrack, remainingAmount } from '../utils/track-factory';

type ScenarioParamKey = 'primeDeltaPct' | 'variableDeltaPct' | 'cpiAnnualPct' | 'changeMonth';

type Params = {
  initialInput?: MixInput;
  initialPropertyKind?: PropertyKind;
};

export interface UseScenarioCalculatorResult {
  mix: MixInput;
  propertyKind: PropertyKind;
  setPropertyKind: (value: PropertyKind) => void;
  setMoney: (field: 'mortgageAmount' | 'propertyValue' | 'equity', value: number) => void;
  setTermMonths: (value: number) => void;
  addTrack: () => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<TrackInput>) => void;
  presetKey: ScenarioPresetKey;
  applyPreset: (key: Exclude<ScenarioPresetKey, 'custom'>) => void;
  scenario: StressScenario;
  setParam: (field: ScenarioParamKey, value: number) => void;
  setPaymentThreshold: (value: number | null) => void;
  result: StressResult;
}

// Prime entry is the Bank-of-Israel base; the engine adds the 1.5% margin, so
// 4.5 renders as a realistic ~6% effective prime.
const DEFAULT_MIX: MixInput = {
  mortgageAmount: 800_000_00,
  propertyValue: 1_200_000_00,
  equity: 400_000_00,
  defaultTermMonths: 360,
  tracks: [
    newTrack('fixed_unlinked', 270_000_00, 4.5),
    newTrack('prime', 260_000_00, 4.5),
    newTrack('variable_linked', 270_000_00, 4.2, 2.5),
  ],
};

export function useScenarioCalculator({
  initialInput,
  initialPropertyKind = 'first_home',
}: Params = {}): UseScenarioCalculatorResult {
  const [propertyKind, setPropertyKind] = useState<PropertyKind>(initialPropertyKind);
  const [mix, setMix] = useState<MixInput>(initialInput ?? DEFAULT_MIX);
  const [presetKey, setPresetKey] = useState<ScenarioPresetKey>('moderate');
  const [scenario, setScenario] = useState<StressScenario>({ ...SCENARIO_PRESETS.moderate, paymentThreshold: null });
  const result = useMemo<StressResult>(() => stressMix(mix, scenario), [mix, scenario]);

  const setMoney = (field: 'mortgageAmount' | 'propertyValue' | 'equity', value: number) =>
    setMix((current) => ({ ...current, [field]: value }));
  const setTermMonths = (value: number) => setMix((current) => ({ ...current, defaultTermMonths: value }));
  const addTrack = () =>
    setMix((current) => ({
      ...current,
      tracks: [...current.tracks, newTrack('fixed_unlinked', remainingAmount(current.mortgageAmount, current.tracks), 4.5)],
    }));
  const removeTrack = (id: string) =>
    setMix((current) => ({
      ...current,
      tracks: current.tracks.length === 1 ? current.tracks : current.tracks.filter((track) => track.id !== id),
    }));
  const updateTrack = (id: string, patch: Partial<TrackInput>) =>
    setMix((current) => ({
      ...current,
      tracks: current.tracks.map((track) => (track.id === id ? normalizeTrack({ ...track, ...patch }) : track)),
    }));

  const applyPreset = (key: Exclude<ScenarioPresetKey, 'custom'>) => {
    setPresetKey(key);
    setScenario((current) => ({ ...SCENARIO_PRESETS[key], paymentThreshold: current.paymentThreshold }));
  };
  const setParam = (field: ScenarioParamKey, value: number) => {
    setPresetKey('custom');
    setScenario((current) => ({ ...current, [field]: value }));
  };
  const setPaymentThreshold = (value: number | null) =>
    setScenario((current) => ({ ...current, paymentThreshold: value }));

  return {
    mix,
    propertyKind,
    setPropertyKind,
    setMoney,
    setTermMonths,
    addTrack,
    removeTrack,
    updateTrack,
    presetKey,
    applyPreset,
    scenario,
    setParam,
    setPaymentThreshold,
    result,
  };
}
