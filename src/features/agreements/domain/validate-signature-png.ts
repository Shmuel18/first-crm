/** A drawn signature is a few hundred px; this is generous headroom. */
const MAX_SIDE_PX = 4096;

/**
 * Validate a decoded signature PNG: real magic bytes AND sane dimensions.
 *
 * The dimension check is the load-bearing half. A tiny, perfectly valid PNG can
 * declare a huge IHDR (e.g. 30000×30000): the PDF renderer allocates its pixel
 * buffers from those declared dimensions BEFORE it discovers the data is short,
 * so a 40 KB upload turns into a multi-GB allocation that OOMs the function.
 */
export function isValidSignaturePng(buf: Buffer, maxBytes: number): boolean {
  // 8-byte signature + 4-byte length + "IHDR" + 13-byte header.
  if (buf.length < 33 || buf.length > maxBytes) return false;
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!magic.every((b, i) => buf[i] === b)) return false;
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return false;

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return width > 0 && height > 0 && width <= MAX_SIDE_PX && height <= MAX_SIDE_PX;
}
