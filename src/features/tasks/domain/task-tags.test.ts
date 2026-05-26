import { describe, expect, it } from 'vitest';

import { filterTasksByTag, isTaskTag, parseTaskTags, TAG_COLOR } from './task-tags';

import type { TaskTag } from '../types';

describe('isTaskTag', () => {
  it('returns true for each of the canonical tag values', () => {
    const canonical: TaskTag[] = ['meeting', 'lead', 'export', 'legal', 'docs', 'followup', 'bank'];
    for (const t of canonical) expect(isTaskTag(t)).toBe(true);
  });

  it('returns false for unknown strings', () => {
    expect(isTaskTag('unknown')).toBe(false);
    expect(isTaskTag('')).toBe(false);
    expect(isTaskTag('Meeting')).toBe(false); // case-sensitive on purpose
  });
});

describe('parseTaskTags', () => {
  it('keeps known tags in input order', () => {
    expect(parseTaskTags(['lead', 'docs', 'bank'])).toEqual(['lead', 'docs', 'bank']);
  });

  it('drops unknown values', () => {
    expect(parseTaskTags(['lead', 'unknown', 'docs', '<script>'])).toEqual(['lead', 'docs']);
  });

  it('de-duplicates repeats while preserving first occurrence', () => {
    expect(parseTaskTags(['lead', 'docs', 'lead', 'docs'])).toEqual(['lead', 'docs']);
  });

  it('returns an empty array for empty input', () => {
    expect(parseTaskTags([])).toEqual([]);
  });

  it('returns an empty array when nothing is known', () => {
    expect(parseTaskTags(['foo', 'bar'])).toEqual([]);
  });
});

describe('filterTasksByTag', () => {
  const tasks = [
    { id: 'a', tags: ['lead', 'docs'] as TaskTag[] },
    { id: 'b', tags: ['bank'] as TaskTag[] },
    { id: 'c', tags: [] as TaskTag[] },
    { id: 'd', tags: ['lead'] as TaskTag[] },
  ];

  it('returns tasks whose tags include the requested one', () => {
    expect(filterTasksByTag(tasks, 'lead').map((t) => t.id)).toEqual(['a', 'd']);
  });

  it('returns every task when tag is null', () => {
    expect(filterTasksByTag(tasks, null).map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns every task when tag is unknown (treats as no-filter)', () => {
    expect(filterTasksByTag(tasks, 'not-a-tag').map((t) => t.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('returns a fresh array (does not mutate the source)', () => {
    const out = filterTasksByTag(tasks, null);
    expect(out).not.toBe(tasks);
  });
});

describe('TAG_COLOR', () => {
  it('declares a color for every known tag (keeps the chip dot from going invisible)', () => {
    const tags: TaskTag[] = ['meeting', 'lead', 'export', 'legal', 'docs', 'followup', 'bank'];
    for (const t of tags) {
      expect(TAG_COLOR[t]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
