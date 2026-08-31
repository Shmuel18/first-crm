import { describe, expect, it } from 'vitest';

import { isValidSignaturePng } from './validate-signature-png';

const MAX = 200 * 1024;

/** Minimal PNG head: signature + IHDR length/type + width/height. */
function pngHead(width: number, height: number, totalBytes = 64): Buffer {
  const buf = Buffer.alloc(totalBytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'latin1');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe('isValidSignaturePng', () => {
  it('accepts a normally-sized signature', () => {
    expect(isValidSignaturePng(pngHead(554, 160), MAX)).toBe(true);
  });

  it('rejects a decompression bomb: tiny file declaring huge dimensions', () => {
    // The whole point: 64 bytes on the wire, ~3.6 GB of pixel buffers if the
    // renderer ever allocates from this header.
    expect(isValidSignaturePng(pngHead(30000, 30000), MAX)).toBe(false);
  });

  it('rejects zero-sized dimensions', () => {
    expect(isValidSignaturePng(pngHead(0, 160), MAX)).toBe(false);
    expect(isValidSignaturePng(pngHead(554, 0), MAX)).toBe(false);
  });

  it('rejects a non-PNG payload even when it is the right length', () => {
    const jpeg = pngHead(554, 160);
    jpeg.writeUInt8(0xff, 0);
    expect(isValidSignaturePng(jpeg, MAX)).toBe(false);
  });

  it('rejects a PNG whose first chunk is not IHDR', () => {
    const buf = pngHead(554, 160);
    buf.write('IDAT', 12, 'latin1');
    expect(isValidSignaturePng(buf, MAX)).toBe(false);
  });

  it('rejects payloads that are truncated or over the byte cap', () => {
    expect(isValidSignaturePng(pngHead(554, 160).subarray(0, 20), MAX)).toBe(false);
    expect(isValidSignaturePng(pngHead(554, 160, MAX + 1), MAX)).toBe(false);
  });
});
