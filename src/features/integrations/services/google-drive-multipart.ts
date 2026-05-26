/**
 * Build a multipart/related upload body for the Drive v3 upload endpoint.
 * Separated from the client so the byte-assembly logic can be unit-tested
 * without an HTTP fixture, and so the client file stays readable as a
 * thin HTTP wrapper around the Drive surface.
 *
 * Drive expects:
 *   --boundary
 *   Content-Type: application/json
 *
 *   { "name": "...", "parents": ["..."] }
 *   --boundary
 *   Content-Type: <file mime>
 *
 *   <file bytes>
 *   --boundary--
 */
export type MultipartUploadBody = {
  body: BodyInit;
  contentType: string;
};

export function buildMultipartUploadBody(file: {
  content: ArrayBuffer | Uint8Array;
  name: string;
  mimeType: string;
  parentId: string;
}): MultipartUploadBody {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const metadata = { name: file.name, parents: [file.parentId] };

  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${file.mimeType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const bytes = file.content instanceof Uint8Array ? file.content : new Uint8Array(file.content);
  const fileBuf = Buffer.from(bytes);
  const body = Buffer.concat([head, fileBuf, tail]);

  return {
    body: new Uint8Array(body),
    contentType: `multipart/related; boundary=${boundary}`,
  };
}
