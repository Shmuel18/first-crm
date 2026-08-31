'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Eraser } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  /** Fired with the PNG data URL after each stroke; null when cleared/empty. */
  onChange: (dataUrl: string | null) => void;
};

const PAD_HEIGHT = 160;

/**
 * Finger/mouse signature canvas — no dependency, pointer events only.
 *
 * Sizing is driven by a ResizeObserver rather than a one-shot measurement on
 * mount. Measuring once was wrong in practice: the pad's container reports
 * clientWidth 0 on the first layout pass of the public signing page, which
 * produced a 0px-wide canvas that silently accepted no ink at all — the pad
 * looked normal (the dashed frame is the parent) but could never be signed.
 * The observer also keeps the pad correct across orientation changes and the
 * mobile keyboard opening; existing ink is rescaled, not wiped.
 *
 * The backing store is DPR-scaled so the exported PNG stays sharp in the PDF;
 * `touch-action: none` keeps the page from scrolling mid-stroke.
 */
export function SignaturePad({ onChange }: Props) {
  const t = useTranslations('agreements.sign');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const cssWidth = useRef(0);
  const [hasInk, setHasInk] = useState(false);

  /** (Re)apply the stroke settings — a canvas resize resets its context. */
  const applyStrokeStyle = useCallback((ctx: CanvasRenderingContext2D, dpr: number): void => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.25;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0A0A0A';
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const resize = (): void => {
      const width = parent.clientWidth;
      // 0 happens on the first layout pass; wait for the next observation
      // rather than baking a zero-width (unsignable) backing store.
      if (width <= 0 || width === cssWidth.current) return;

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      // Preserve whatever is already drawn — a resize mid-signature (keyboard,
      // rotation) must not silently erase the client's signature.
      let previous: HTMLCanvasElement | null = null;
      if (cssWidth.current > 0 && canvas.width > 0) {
        previous = document.createElement('canvas');
        previous.width = canvas.width;
        previous.height = canvas.height;
        previous.getContext('2d')?.drawImage(canvas, 0, 0);
      }

      cssWidth.current = width;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(PAD_HEIGHT * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${PAD_HEIGHT}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      applyStrokeStyle(ctx, dpr);
      if (previous) ctx.drawImage(previous, 0, 0, width, PAD_HEIGHT);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [applyStrokeStyle]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A dot for a tap, so even the shortest press leaves ink.
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onPointerUp = (): void => {
    if (!drawing.current) return;
    drawing.current = false;
    setHasInk(true);
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL('image/png'));
  };

  const clear = (): void => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      // clearRect honours the DPR transform, so clear in CSS pixels.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-neutral-300 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="block w-full touch-none rounded-xl"
          style={{ height: PAD_HEIGHT }}
          aria-label={t('padAria')}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
            {t('padHint')}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={!hasInk}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-800 disabled:opacity-40"
      >
        <Eraser className="size-3.5" aria-hidden="true" />
        {t('clear')}
      </button>
    </div>
  );
}
