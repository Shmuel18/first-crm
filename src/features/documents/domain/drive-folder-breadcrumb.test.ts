import { describe, expect, it } from 'vitest';

import type { DriveFolderNode } from '../types';
import { driveFolderBreadcrumb } from './drive-folder-breadcrumb';

const root: DriveFolderNode = {
  id: 'root',
  parentId: 'case',
  name: 'Income',
  relativePath: ['Income'],
};
const year: DriveFolderNode = {
  id: 'year',
  parentId: 'root',
  name: '2026',
  relativePath: ['Income', '2026'],
};
const month: DriveFolderNode = {
  id: 'month',
  parentId: 'year',
  name: 'August',
  relativePath: ['Income', '2026', 'August'],
};

describe('driveFolderBreadcrumb', () => {
  it('returns the complete root-to-current path using stable ids', () => {
    expect(driveFolderBreadcrumb(root, month.id, [root, year, month])).toEqual([root, year, month]);
  });

  it('uses the latest display names without changing folder identity', () => {
    const renamed = { ...year, name: 'Tax year 2026' };
    expect(
      driveFolderBreadcrumb(root, month.id, [root, renamed, month]).map(({ name }) => name),
    ).toEqual(['Income', 'Tax year 2026', 'August']);
  });

  it('falls back to the selected root for missing, moved, or cyclic ancestry', () => {
    expect(driveFolderBreadcrumb(root, 'missing', [root, year, month])).toEqual([root]);
    expect(
      driveFolderBreadcrumb(root, month.id, [root, { ...year, parentId: 'elsewhere' }, month]),
    ).toEqual([root]);
    expect(
      driveFolderBreadcrumb(root, month.id, [
        root,
        { ...year, parentId: month.id },
        { ...month, parentId: year.id },
      ]),
    ).toEqual([root]);
  });
});
