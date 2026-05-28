'use client';

import { useMemo, useState } from 'react';

import { DEFAULT_REGULATORY_THRESHOLDS } from '../constants';
import { compareMixes, type MixComparisonResult } from '../domain/mix-compare';
import { validateMix } from '../domain/regulatory-rules';
import type {
  MixInput,
  PropertyKind,
  RegulatoryThresholds,
  RegulatoryViolation,
  TrackInput,
} from '../types';
import { buildMixInput, cloneTracksWithNewIds, newTrack, normalizeTrack, remainingAmount } from '../utils/track-factory';

export const COMPARISON_LABELS = ['A', 'B', 'C', 'D'] as const;
const MAX_VARIANTS = 4;
const MIN_VARIANTS = 2;

export type ComparisonBase = Omit<MixInput, 'tracks'>;
export type ComparisonVariant = { label: string; tracks: ReadonlyArray<TrackInput> };

type Params = {
  initialBase?: ComparisonBase;
  initialPropertyKind?: PropertyKind;
  thresholds?: RegulatoryThresholds;
};

const DEFAULT_BASE: ComparisonBase = {
  mortgageAmount: 800_000_00,
  propertyValue: 1_200_000_00,
  equity: 400_000_00,
  defaultTermMonths: 360,
};

export function useMixComparison({
  initialBase,
  initialPropertyKind = 'first_home',
  thresholds = DEFAULT_REGULATORY_THRESHOLDS,
}: Params = {}) {
  const [base, setBase] = useState<ComparisonBase>(initialBase ?? DEFAULT_BASE);
  const [propertyKind, setPropertyKind] = useState<PropertyKind>(initialPropertyKind);
  const [variants, setVariants] = useState<ReadonlyArray<ComparisonVariant>>(defaultVariants);
  const [activeLabel, setActiveLabel] = useState<string>('A');

  const mixes = useMemo(
    () => variants.map((variant) => ({ label: variant.label, mix: buildMixInput(base, variant.tracks) })),
    [base, variants],
  );
  const comparison = useMemo<MixComparisonResult>(() => compareMixes(mixes), [mixes]);
  const violationsByLabel = useMemo<Record<string, ReadonlyArray<RegulatoryViolation>>>(
    () => Object.fromEntries(mixes.map((item) => [item.label, validateMix(item.mix, thresholds, propertyKind)])),
    [mixes, propertyKind, thresholds],
  );

  const activeVariant = variants.find((variant) => variant.label === activeLabel) ?? variants[0];
  const activeTracks = activeVariant?.tracks ?? [];

  const setMoney = (field: 'mortgageAmount' | 'propertyValue' | 'equity', value: number) =>
    setBase((current) => ({ ...current, [field]: value }));
  const setTermMonths = (value: number) => setBase((current) => ({ ...current, defaultTermMonths: value }));

  const mutateActive = (transform: (tracks: ReadonlyArray<TrackInput>) => ReadonlyArray<TrackInput>) =>
    setVariants((current) =>
      current.map((variant) => (variant.label === activeLabel ? { ...variant, tracks: transform(variant.tracks) } : variant)),
    );
  const addTrack = () =>
    mutateActive((tracks) => [...tracks, newTrack('fixed_unlinked', remainingAmount(base.mortgageAmount, tracks), 4.5)]);
  const removeTrack = (id: string) =>
    mutateActive((tracks) => (tracks.length === 1 ? tracks : tracks.filter((track) => track.id !== id)));
  const updateTrack = (id: string, patch: Partial<TrackInput>) =>
    mutateActive((tracks) => tracks.map((track) => (track.id === id ? normalizeTrack({ ...track, ...patch }) : track)));

  const addVariant = () =>
    setVariants((current) => {
      if (current.length >= MAX_VARIANTS) return current;
      const template = current.find((variant) => variant.label === activeLabel) ?? current.at(-1);
      const label = COMPARISON_LABELS[current.length] ?? `V${current.length + 1}`;
      return [...current, { label, tracks: cloneTracksWithNewIds(template?.tracks ?? []) }];
    });
  const removeVariant = (label: string) =>
    setVariants((current) => {
      if (current.length <= MIN_VARIANTS) return current;
      const next = current.filter((variant) => variant.label !== label);
      const relabeled = next.map((variant, index) => ({ ...variant, label: COMPARISON_LABELS[index] ?? variant.label }));
      setActiveLabel('A');
      return relabeled;
    });

  return {
    base,
    setMoney,
    setTermMonths,
    propertyKind,
    setPropertyKind,
    variants,
    activeLabel,
    setActiveLabel,
    activeTracks,
    addTrack,
    removeTrack,
    updateTrack,
    addVariant,
    removeVariant,
    canAddVariant: variants.length < MAX_VARIANTS,
    canRemoveVariant: variants.length > MIN_VARIANTS,
    comparison,
    violationsByLabel,
    activeViolations: violationsByLabel[activeLabel] ?? [],
  };
}

function defaultVariants(): ReadonlyArray<ComparisonVariant> {
  return [
    {
      label: 'A',
      tracks: [
        newTrack('fixed_unlinked', 270_000_00, 4.5),
        newTrack('prime', 260_000_00, 6.0),
        newTrack('variable_linked', 270_000_00, 4.2, 2.5),
      ],
    },
    {
      label: 'B',
      tracks: [newTrack('fixed_unlinked', 400_000_00, 4.6), newTrack('prime', 400_000_00, 6.0)],
    },
  ];
}
