'use client';

import { useState } from 'react';

import { useDocumentImage } from '../hooks/use-document-image';

type Props = {
  src: string;
  mimeType: string | null;
  alt: string;
  fallback: React.ReactNode;
};

/**
 * Image tile drawn from bytes we fetched, not from a URL handed to the browser.
 * A plain <img> pointed at the documents route is a file-shaped request, and
 * the office content filter replaces those with its block page — which the
 * browser then shows as its broken-image glyph, indistinguishable from a
 * missing file. Going through the fetch layer means a blocked image degrades to
 * the file-type icon and says so in the console.
 */
export function DocumentImageThumb({ src, mimeType, alt, fallback }: Props) {
  const image = useDocumentImage(src, mimeType);
  // Bytes can arrive fine and still be undecodable (e.g. HEIC in Chrome).
  const [decodeFailed, setDecodeFailed] = useState(false);

  if (image.status === 'failed' || decodeFailed) {
    return <div className="flex size-full items-center justify-center">{fallback}</div>;
  }
  if (image.status === 'loading') {
    return <div className="size-full animate-pulse bg-neutral-100" aria-hidden="true" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      alt={alt}
      onError={() => setDecodeFailed(true)}
      className="absolute inset-0 size-full object-cover"
    />
  );
}
