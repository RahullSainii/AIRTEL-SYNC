'use client';

import type { Worker } from 'tesseract.js';
import { parseDocument, type OcrLine } from './parse.ts';
import type { DocType, ExtractedDoc } from '../types.ts';

// OCR runs in the browser with self-hosted files, so document images never leave the device.
let workerPromise: Promise<Worker> | null = null;
let queue: Promise<unknown> = Promise.resolve();

export function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr/lang', gzip: true }),
    );
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

export type OcrResult = { lines: OcrLine[]; confidence: number; text: string; ms: number };

export function ocrImage(image: string | HTMLCanvasElement | Blob): Promise<OcrResult> {
  // One worker processes images sequentially; chaining keeps concurrent callers ordered.
  const run = queue.then(async () => {
    const worker = await getOcrWorker();
    const t0 = performance.now();
    const { data } = await worker.recognize(image, { rotateAuto: true }, { text: true, blocks: true });
    const lines: OcrLine[] = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.map((l) => ({ text: l.text.trim(), confidence: l.confidence }))));
    return { lines, confidence: data.confidence, text: data.text, ms: Math.round(performance.now() - t0) };
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function extractDocument(image: string | HTMLCanvasElement | Blob, hint: DocType): Promise<ExtractedDoc> {
  const r = await ocrImage(image);
  return { ...parseDocument(r.lines, hint, r.confidence), ms: r.ms };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
