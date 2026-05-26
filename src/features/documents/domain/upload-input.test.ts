import { afterEach, describe, expect, it, vi } from 'vitest';

import { fileTypeFromBuffer } from 'file-type';

import { MAX_FILE_SIZE_BYTES } from '../schemas/document.schema';

import { parseUploadInput } from './upload-input';

// file-type's magic-byte sniff is the heart of this validator — mock it so
// we can simulate the "browser lied about file.type" attacker scenario
// without crafting binary PDFs etc.
vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}));

const mockFileTypeFromBuffer = vi.mocked(fileTypeFromBuffer);

afterEach(() => {
  mockFileTypeFromBuffer.mockReset();
});

const VALID_UUID = '00000000-0000-4000-8000-000000000000';

// Translator stub that returns the key — keeps assertions tied to message
// keys instead of the actual Hebrew/English copy.
const t = ((key: string) => key) as unknown as Parameters<typeof parseUploadInput>[1];

function makeFile(opts: { name?: string; type?: string; size?: number }): File {
  // Filler bytes — content doesn't matter because file-type is mocked.
  // String parts dodge the Uint8Array → BlobPart type friction.
  const filler = 'x'.repeat(opts.size ?? 100);
  return new File([filler], opts.name ?? 'doc.pdf', { type: opts.type ?? 'application/pdf' });
}

// Helper to satisfy file-type's FileTypeResult shape (it wants both mime and
// ext) without each callsite repeating ext: 'whatever'.
function sniffed(mime: string) {
  // ext is irrelevant for our validator — we only key off mime.
  return { mime, ext: 'bin' as const };
}

function makeForm(over: Partial<{ case_id: string; file: File; category_id: string; borrower_id: string }>): FormData {
  const fd = new FormData();
  fd.set('case_id', over.case_id ?? VALID_UUID);
  if (over.file) fd.set('file', over.file);
  fd.set('category_id', over.category_id ?? VALID_UUID);
  if (over.borrower_id) fd.set('borrower_id', over.borrower_id);
  return fd;
}

describe('parseUploadInput', () => {
  it('rejects missing/invalid case_id', async () => {
    const fd = makeForm({ file: makeFile({}), case_id: 'not-a-uuid' });
    mockFileTypeFromBuffer.mockResolvedValueOnce(sniffed('application/pdf'));
    const result = await parseUploadInput(fd, t);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('caseIdMissing');
  });

  it('rejects when no file field is present', async () => {
    const fd = new FormData();
    fd.set('case_id', VALID_UUID);
    const result = await parseUploadInput(fd, t);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('fileRequired');
  });

  it('rejects a zero-byte file', async () => {
    const fd = makeForm({ file: makeFile({ size: 0 }) });
    const result = await parseUploadInput(fd, t);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('fileRequired');
  });

  it('rejects a file over MAX_FILE_SIZE_BYTES', async () => {
    const fd = makeForm({ file: makeFile({ size: MAX_FILE_SIZE_BYTES + 1 }) });
    const result = await parseUploadInput(fd, t);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('fileTooLarge');
  });

  it('rejects a disallowed declared MIME type', async () => {
    const fd = makeForm({ file: makeFile({ type: 'application/x-msdownload' }) });
    const result = await parseUploadInput(fd, t);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('fileTypeNotAllowed');
  });

  it("rejects when magic-byte sniff doesn't match an allowed MIME (attacker lying about file.type)", async () => {
    // Declared as PDF; magic-byte says it's actually executable.
    mockFileTypeFromBuffer.mockResolvedValueOnce(sniffed('application/x-msdownload'));
    const fd = makeForm({ file: makeFile({ type: 'application/pdf' }) });
    const result = await parseUploadInput(fd, t);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('fileTypeNotAllowed');
  });

  it('rejects when magic-byte sniff returns undefined (unidentifiable bytes)', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce(undefined);
    const fd = makeForm({ file: makeFile({ type: 'application/pdf' }) });
    const result = await parseUploadInput(fd, t);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('fileTypeNotAllowed');
  });

  it('rejects when category_id is missing (Zod validation)', async () => {
    // Magic-byte sniff must succeed first, otherwise we never reach the
    // metadata parse — we'd fail with `fileTypeNotAllowed` instead.
    mockFileTypeFromBuffer.mockResolvedValueOnce(sniffed('application/pdf'));
    const fd = new FormData();
    fd.set('case_id', VALID_UUID);
    fd.set('file', makeFile({}));
    // no category_id
    const result = await parseUploadInput(fd, t);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors).toBeDefined();
  });

  it('accepts a valid upload (matching declared + sniffed MIME)', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce(sniffed('application/pdf'));
    const fd = makeForm({ file: makeFile({ type: 'application/pdf', size: 1024 }) });
    const result = await parseUploadInput(fd, t);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.caseId).toBe(VALID_UUID);
      expect(result.file.type).toBe('application/pdf');
      expect(result.meta.category_id).toBe(VALID_UUID);
    }
  });

  it('accepts image/jpeg when sniff matches', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce(sniffed('image/jpeg'));
    const fd = makeForm({ file: makeFile({ type: 'image/jpeg' }) });
    const result = await parseUploadInput(fd, t);
    expect(result.ok).toBe(true);
  });
});
