import { describe, expect, it } from 'vitest';

import type { Json } from '@/types/database';

import type { DocumentWithRelations, DriveFolderNode } from '../types';
import {
  canonicalDriveFolderRoots,
  descendantFolderIds,
  documentsDirectlyInDriveFolder,
  documentsInsideDriveFolder,
  hasCaseDriveFolderSnapshot,
  readCaseDriveFolderTree,
  readCaseDriveSubfolderIds,
  readDocumentDriveLocation,
} from './drive-folder-tree';

function document(id: string, metadata: Json): DocumentWithRelations {
  return { id, metadata } as DocumentWithRelations;
}

const root: DriveFolderNode = {
  id: 'income',
  parentId: 'case',
  name: '02_income',
  relativePath: ['02_income'],
};
const year: DriveFolderNode = {
  id: '2026',
  parentId: 'income',
  name: '2026',
  relativePath: ['02_income', '2026'],
};
const month: DriveFolderNode = {
  id: 'august',
  parentId: '2026',
  name: 'August',
  relativePath: ['02_income', '2026', 'August'],
};

describe('Drive folder metadata', () => {
  it('parses a valid folder snapshot and ignores malformed or duplicate nodes', () => {
    const metadata: Json = {
      drive: {
        folder_tree: [
          { id: 'income', parent_id: 'case', name: 'Income', relative_path: ['Income'] },
          { id: 'income', parent_id: 'case', name: 'Duplicate', relative_path: ['Duplicate'] },
          { id: 7, parent_id: 'case', name: 'bad', relative_path: ['bad'] },
          { id: 'missing-path', parent_id: 'case', name: 'bad' },
        ],
      },
    };

    expect(readCaseDriveFolderTree(metadata)).toEqual([
      {
        id: 'income',
        parentId: 'case',
        name: 'Income',
        relativePath: ['Income'],
      },
    ]);
  });

  it('reads only supported canonical subfolder ids', () => {
    expect(
      readCaseDriveSubfolderIds({
        drive: { subfolders: { income_il: 'income', custom: 'ignore', identity: 4 } },
      }),
    ).toEqual({ income_il: 'income' });
  });

  it('distinguishes a trusted empty folder snapshot from legacy metadata', () => {
    expect(hasCaseDriveFolderSnapshot({ drive: { folder_tree: [] } })).toBe(true);
    expect(hasCaseDriveFolderSnapshot({ drive: { case_folder_id: 'case' } })).toBe(false);
    expect(hasCaseDriveFolderSnapshot(null)).toBe(false);
  });

  it('safely reads per-document parent id and relative folder path', () => {
    expect(
      readDocumentDriveLocation(
        document('doc', {
          drive_parent_folder_id: '2026',
          drive_relative_path: ['02_income', '2026'],
        }),
      ),
    ).toEqual({ parentFolderId: '2026', relativePath: ['02_income', '2026'] });
    expect(readDocumentDriveLocation(document('bad', { drive_relative_path: ['ok', 3] }))).toEqual({
      parentFolderId: null,
      relativePath: [],
    });
  });
});

describe('Drive folder hierarchy', () => {
  const tree = [root, year, month];
  const docs = [
    document('root-doc', {
      drive_parent_folder_id: 'income',
      drive_relative_path: ['02_income'],
    }),
    document('year-doc', {
      drive_parent_folder_id: '2026',
      drive_relative_path: ['02_income', '2026'],
    }),
    document('month-doc', {
      drive_parent_folder_id: 'august',
      drive_relative_path: ['02_income', '2026', 'August'],
    }),
    document('elsewhere', {
      drive_parent_folder_id: 'identity',
      drive_relative_path: ['01_identity'],
    }),
  ];

  it('collects every descendant using stable folder ids', () => {
    expect(descendantFolderIds('income', tree)).toEqual(new Set(['income', '2026', 'august']));
    expect(documentsInsideDriveFolder(docs, root, tree).map(({ id }) => id)).toEqual([
      'root-doc',
      'year-doc',
      'month-doc',
    ]);
  });

  it('shows only directly contained files at each drill-in level', () => {
    expect(documentsDirectlyInDriveFolder(docs, root).map(({ id }) => id)).toEqual(['root-doc']);
    expect(documentsDirectlyInDriveFolder(docs, year).map(({ id }) => id)).toEqual(['year-doc']);
    expect(documentsDirectlyInDriveFolder(docs, month).map(({ id }) => id)).toEqual(['month-doc']);
  });

  it('keeps a partially-synced document visible at the category root', () => {
    const orphan = document('new-folder-doc', {
      drive_parent_folder_id: 'new-folder-not-in-snapshot',
      drive_relative_path: ['02_income', 'new-folder'],
    });
    const visible = documentsDirectlyInDriveFolder([docs[0]!, docs[1]!, orphan], root, {
      includeParentsOutside: descendantFolderIds(root.id, tree),
    });

    expect(visible.map(({ id }) => id)).toEqual(['root-doc', 'new-folder-doc']);
  });
});

describe('canonical Drive roots', () => {
  it('prefers a cached direct-child id even when a duplicate has the canonical name', () => {
    const stable = { ...root, id: 'stable', name: 'Renamed income' };
    const duplicate = { ...root, id: 'duplicate', name: '02_תעסוקה_והכנסות' };

    expect(canonicalDriveFolderRoots('case', [duplicate, stable], { income_il: 'stable' })).toEqual(
      { income_il: stable },
    );
  });

  it('does not treat a cached folder moved below another folder as a root', () => {
    const moved = { ...root, id: 'stable', parentId: 'custom', name: 'Renamed income' };
    expect(canonicalDriveFolderRoots('case', [moved], { income_il: 'stable' })).toEqual({});
  });

  it('uses the name fallback only when exactly one direct-root match exists', () => {
    const named = { ...root, id: 'one', name: '02_תעסוקה_והכנסות' };
    expect(canonicalDriveFolderRoots('case', [named], {})).toEqual({ income_il: named });
    expect(canonicalDriveFolderRoots('case', [named, { ...named, id: 'two' }], {})).toEqual({});
  });
});
