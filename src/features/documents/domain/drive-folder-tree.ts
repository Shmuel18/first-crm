import type { Json } from '@/types/database';

import { DRIVE_SUBFOLDER_NAMES } from '@/features/integrations/domain/drive-folder-naming';

import type {
  DocumentDriveLocation,
  DocumentWithRelations,
  DriveFolder,
  DriveFolderNode,
} from '../types';
import { DRIVE_FOLDERS } from '../types';

type JsonRecord = Record<string, Json | undefined>;

function asRecord(value: Json | null | undefined): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringArray(value: Json | undefined): string[] | null {
  if (!Array.isArray(value) || !value.every((part) => typeof part === 'string')) return null;
  return value;
}

/** Parse the latest complete folder snapshot without trusting arbitrary JSON. */
export function readCaseDriveFolderTree(metadata: Json | null): DriveFolderNode[] {
  const drive = asRecord(asRecord(metadata)?.drive);
  const rawTree = drive?.folder_tree;
  if (!Array.isArray(rawTree)) return [];

  const nodes: DriveFolderNode[] = [];
  const seenIds = new Set<string>();
  for (const rawNode of rawTree) {
    const node = asRecord(rawNode);
    if (!node) continue;
    const id = node.id;
    const parentId = node.parent_id;
    const name = node.name;
    const relativePath = stringArray(node.relative_path);
    if (
      typeof id !== 'string' ||
      id.length === 0 ||
      seenIds.has(id) ||
      typeof parentId !== 'string' ||
      parentId.length === 0 ||
      typeof name !== 'string' ||
      name.length === 0 ||
      !relativePath
    ) {
      continue;
    }
    seenIds.add(id);
    nodes.push({ id, parentId, name, relativePath });
  }
  return nodes;
}

/** Distinguish a trusted empty Drive tree from legacy metadata that has never
 * completed the recursive snapshot introduced by exact-mirror sync. */
export function hasCaseDriveFolderSnapshot(metadata: Json | null): boolean {
  const drive = asRecord(asRecord(metadata)?.drive);
  return Array.isArray(drive?.folder_tree);
}

/** Stable ids of the five provisioned category folders, if already known. */
export function readCaseDriveSubfolderIds(
  metadata: Json | null,
): Partial<Record<DriveFolder, string>> {
  const drive = asRecord(asRecord(metadata)?.drive);
  const rawSubfolders = asRecord(drive?.subfolders);
  if (!rawSubfolders) return {};

  const out: Partial<Record<DriveFolder, string>> = {};
  for (const key of [
    'identity',
    'income_il',
    'income_abroad',
    'insurance_collateral',
    'misc',
  ] as const) {
    const id = rawSubfolders[key];
    if (typeof id === 'string' && id.length > 0) out[key] = id;
  }
  return out;
}

export function readDocumentDriveLocation(
  document: Pick<DocumentWithRelations, 'metadata'>,
): DocumentDriveLocation {
  const metadata = asRecord(document.metadata);
  const parentFolderId = metadata?.drive_parent_folder_id;
  return {
    parentFolderId:
      typeof parentFolderId === 'string' && parentFolderId.length > 0 ? parentFolderId : null,
    relativePath: stringArray(metadata?.drive_relative_path) ?? [],
  };
}

export function descendantFolderIds(
  rootFolderId: string,
  nodes: ReadonlyArray<DriveFolderNode>,
): Set<string> {
  const ids = new Set<string>([rootFolderId]);
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  }
  const pending = [rootFolderId];
  for (let index = 0; index < pending.length; index += 1) {
    const parentId = pending[index];
    if (!parentId) continue;
    for (const childId of childrenByParent.get(parentId) ?? []) {
      if (!ids.has(childId)) {
        ids.add(childId);
        pending.push(childId);
      }
    }
  }
  return ids;
}

/**
 * Resolve the five managed category roots without pretending a moved folder is
 * still at the case root. A cached id wins only when it is a direct child. The
 * name fallback is accepted only when unambiguous; duplicate same-name Drive
 * folders remain custom and independently visible.
 */
export function canonicalDriveFolderRoots(
  caseFolderId: string | null,
  nodes: ReadonlyArray<DriveFolderNode>,
  stableIds: Partial<Record<DriveFolder, string>>,
): Partial<Record<DriveFolder, DriveFolderNode>> {
  if (!caseFolderId) return {};
  const roots: Partial<Record<DriveFolder, DriveFolderNode>> = {};
  for (const folder of DRIVE_FOLDERS) {
    const stableId = stableIds[folder];
    const stableNode = stableId
      ? nodes.find((node) => node.id === stableId && node.parentId === caseFolderId)
      : undefined;
    if (stableNode) {
      roots[folder] = stableNode;
      continue;
    }

    const nameMatches = nodes.filter(
      (node) => node.parentId === caseFolderId && node.name === DRIVE_SUBFOLDER_NAMES[folder],
    );
    if (nameMatches.length === 1) roots[folder] = nameMatches[0];
  }
  return roots;
}

export function documentsInsideDriveFolder(
  documents: ReadonlyArray<DocumentWithRelations>,
  rootFolder: DriveFolderNode,
  nodes: ReadonlyArray<DriveFolderNode>,
): DocumentWithRelations[] {
  const descendantIds = descendantFolderIds(rootFolder.id, nodes);
  return documents.filter((document) => {
    const location = readDocumentDriveLocation(document);
    if (location.parentFolderId) return descendantIds.has(location.parentFolderId);
    return pathStartsWith(location.relativePath, rootFolder.relativePath);
  });
}

export function documentsDirectlyInDriveFolder(
  documents: ReadonlyArray<DocumentWithRelations>,
  folder: DriveFolderNode,
  options: {
    includeUnlocated?: boolean;
    /** At a root view, keep partially-synced documents visible when their
     * freshly-written parent has not yet reached the last trusted tree. */
    includeParentsOutside?: ReadonlySet<string>;
  } = {},
): DocumentWithRelations[] {
  return documents.filter((document) => {
    const location = readDocumentDriveLocation(document);
    if (location.parentFolderId) {
      return (
        location.parentFolderId === folder.id ||
        (options.includeParentsOutside !== undefined &&
          !options.includeParentsOutside.has(location.parentFolderId))
      );
    }
    if (location.relativePath.length > 0) {
      return pathsEqual(location.relativePath, folder.relativePath);
    }
    return options.includeUnlocated === true;
  });
}

export function pathStartsWith(path: ReadonlyArray<string>, prefix: ReadonlyArray<string>) {
  return prefix.length > 0 && prefix.every((part, index) => path[index] === part);
}

function pathsEqual(left: ReadonlyArray<string>, right: ReadonlyArray<string>) {
  return left.length === right.length && left.every((part, index) => right[index] === part);
}
