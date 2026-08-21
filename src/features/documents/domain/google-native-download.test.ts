import { describe, expect, it } from 'vitest';

import {
  documentDownloadName,
  googleNativeDownloadExport,
  isDocumentDownloadable,
  isGoogleNativeMime,
} from './google-native-download';

describe('googleNativeDownloadExport', () => {
  it.each([
    [
      'application/vnd.google-apps.document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.docx',
    ],
    [
      'application/vnd.google-apps.spreadsheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xlsx',
    ],
    [
      'application/vnd.google-apps.presentation',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.pptx',
    ],
  ])('maps %s to its editable Office format', (sourceMime, targetMime, extension) => {
    expect(googleNativeDownloadExport(sourceMime)).toEqual({
      mimeType: targetMime,
      extension,
    });
  });

  it('exports Google Drawings as PDF', () => {
    expect(googleNativeDownloadExport('application/vnd.google-apps.drawing')).toEqual({
      mimeType: 'application/pdf',
      extension: '.pdf',
    });
  });

  it('does not invent an export for unsupported native or regular files', () => {
    expect(googleNativeDownloadExport('application/vnd.google-apps.form')).toBeNull();
    expect(googleNativeDownloadExport('application/pdf')).toBeNull();
    expect(googleNativeDownloadExport(null)).toBeNull();
  });

  it('recognizes the Google-native namespace separately from export support', () => {
    expect(isGoogleNativeMime('application/vnd.google-apps.form')).toBe(true);
    expect(isGoogleNativeMime('application/pdf')).toBe(false);
  });
});

describe('isDocumentDownloadable', () => {
  it('allows ordinary Drive files and supported native exports', () => {
    expect(
      isDocumentDownloadable({
        drive_file_id: 'regular',
        metadata: {},
        mime_type: 'application/pdf',
      }),
    ).toBe(true);
    expect(
      isDocumentDownloadable({
        drive_file_id: 'doc',
        metadata: {},
        mime_type: 'application/vnd.google-apps.document',
      }),
    ).toBe(true);
  });

  it('hides unsupported Drive-only Google-native files', () => {
    expect(
      isDocumentDownloadable({
        drive_file_id: 'form',
        metadata: {},
        mime_type: 'application/vnd.google-apps.form',
      }),
    ).toBe(false);
  });

  it('allows stored bytes even when the Drive-native type is unsupported', () => {
    expect(
      isDocumentDownloadable({
        drive_file_id: 'form',
        metadata: { storage_path: 'case/form-export.bin' },
        mime_type: 'application/vnd.google-apps.form',
      }),
    ).toBe(true);
  });
});

describe('documentDownloadName', () => {
  it.each([
    ['מסמך לקוח', 'application/vnd.google-apps.document', 'מסמך לקוח.docx'],
    ['מאזן.xlsx', 'application/vnd.google-apps.spreadsheet', 'מאזן.xlsx'],
    ['דוח.2026', 'application/vnd.google-apps.spreadsheet', 'דוח.2026.xlsx'],
    ['מצגת.pdf', 'application/vnd.google-apps.presentation', 'מצגת.pptx'],
    ['שרטוט', 'application/vnd.google-apps.drawing', 'שרטוט.pdf'],
  ])('uses the exported extension for %s', (fileName, mimeType, expected) => {
    expect(documentDownloadName(fileName, mimeType)).toBe(expected);
  });

  it('preserves ordinary filenames', () => {
    expect(documentDownloadName('invoice.pdf', 'application/pdf')).toBe('invoice.pdf');
  });

  it('keeps the exported filename within the sanitization length limit', () => {
    const result = documentDownloadName('א'.repeat(200), 'application/vnd.google-apps.document');

    expect(result).toHaveLength(200);
    expect(result.endsWith('.docx')).toBe(true);
  });
});
