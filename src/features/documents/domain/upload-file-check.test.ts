import { describe, expect, it } from 'vitest';

import { MAX_FILE_SIZE_BYTES } from '../schemas/document.schema';

import { getUploadFileError } from './upload-file-check';

describe('getUploadFileError', () => {
  it('accepts an allowed type within the size limit', () => {
    expect(getUploadFileError({ size: 1000, type: 'application/pdf' })).toBeNull();
  });

  it('rejects empty, oversized and unsupported files', () => {
    expect(getUploadFileError({ size: 0, type: 'application/pdf' })).toBe('fileRequired');
    expect(getUploadFileError({ size: MAX_FILE_SIZE_BYTES + 1, type: 'image/png' })).toBe(
      'fileTooLarge',
    );
    expect(getUploadFileError({ size: 10, type: 'application/zip' })).toBe('fileTypeNotAllowed');
  });
});
