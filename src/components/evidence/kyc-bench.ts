'use client';

import answerKey from '@/data/kyc-answer-key.json';
import { extractDocument } from '@/lib/kyc/ocr-client';
import type { DocType, ExtractedDoc, KycVerdict } from '@/lib/types';

export type Variant = 'clean' | 'rotated' | 'blurred' | 'lowlight' | 'cropped' | 'jpeg' | 'combined';
export const VARIANTS: { id: Variant; label: string; detail: string }[] = [
  { id: 'clean', label: 'Clean specimens', detail: 'As provided in the pack' },
  { id: 'rotated', label: 'Rotated 7°', detail: 'Phone held at an angle' },
  { id: 'blurred', label: 'Blurred', detail: 'Hand shake, 1.6 px blur' },
  { id: 'lowlight', label: 'Low light', detail: 'Dim shop, brightness 50%' },
  { id: 'cropped', label: 'Cropped edge', detail: 'Right 6% cut off' },
  { id: 'jpeg', label: 'Heavy compression', detail: 'WhatsApp-forwarded JPEG' },
  { id: 'combined', label: 'All of the above, mild', detail: 'Rotate, blur, dim, compress' },
];

type Key = Record<string, { expected: { status: string; flags: string[]; problem: string }; fields: Partial<Record<DocType, Record<string, string | null>>> }>;
export const KEY = answerKey as Key;
export const APPLICANTS = Object.keys(KEY);
const DOC_TYPES: DocType[] = ['gst_certificate', 'udyam_certificate', 'signatory_id', 'address_proof'];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
}

export async function distort(src: string, v: Variant): Promise<string | HTMLCanvasElement> {
  if (v === 'clean') return src;
  const img = await loadImage(src);
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const angle = v === 'rotated' ? 7 : v === 'combined' ? 3.5 : 0;
  const crop = v === 'cropped' ? 0.94 : 1;
  c.width = Math.round(w * crop); c.height = h;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  const filters = [v === 'blurred' ? 'blur(1.6px)' : v === 'combined' ? 'blur(0.9px)' : '', v === 'lowlight' ? 'brightness(0.5) contrast(0.85)' : v === 'combined' ? 'brightness(0.72) contrast(0.9)' : ''].filter(Boolean);
  ctx.filter = filters.join(' ') || 'none';
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  const scale = angle ? 0.92 : 1;
  ctx.drawImage(img, (-w / 2) * scale, (-h / 2) * scale, w * scale, h * scale);
  if (v === 'jpeg' || v === 'combined') return c.toDataURL('image/jpeg', v === 'jpeg' ? 0.12 : 0.35);
  return c;
}

export type BenchResult = {
  applicant: string; expected: string; problem: string; status: KycVerdict['status']; correct: boolean; falseApproval: boolean;
  raised: string[]; ms: number; verdict: KycVerdict; fieldsRight: number; fieldsTotal: number; perField: Record<string, [number, number]>;
};

const FIELD_GROUP: Record<string, string> = { gstin: 'GSTIN', legalName: 'Name', tradeName: 'Name', name: 'Name', billedTo: 'Name', enterpriseName: 'Name', udyamNumber: 'Udyam no.', pincode: 'Pincode', validTill: 'Date', billDate: 'Date' };
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

export async function runApplicant(app: string, variant: Variant, consentId: string): Promise<BenchResult> {
  const t0 = performance.now();
  const docs: Partial<Record<DocType, ExtractedDoc>> = {};
  for (const type of DOC_TYPES) {
    if (type === 'udyam_certificate' && !KEY[app].fields.udyam_certificate) continue;
    const img = await distort(`/specimens/${app}_${type}.png`, variant);
    docs[type] = await extractDocument(img, type);
  }
  const res = await fetch('/api/kyc/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consentId, docs }) });
  const verdict: KycVerdict = await res.json();
  const ms = Math.round(performance.now() - t0);
  const exp = KEY[app].expected;
  const raised = verdict.checks.filter((c) => c.result !== 'pass' && c.result !== 'info').map((c) => c.id);
  const perField: Record<string, [number, number]> = {};
  let right = 0, total = 0;
  for (const [type, fields] of Object.entries(KEY[app].fields) as [DocType, Record<string, string | null>][]) {
    for (const [name, want] of Object.entries(fields)) {
      const group = FIELD_GROUP[name] ?? name;
      perField[group] ??= [0, 0];
      perField[group][1]++; total++;
      const got = docs[type]?.fields[name]?.value ?? null;
      const ok = name === 'gstin' ? verdict.registry?.gstin?.gstin === want || norm(got) === norm(want) : norm(got) === norm(want);
      if (ok) { perField[group][0]++; right++; }
    }
  }
  return {
    applicant: app, expected: exp.status, problem: exp.problem, status: verdict.status, correct: verdict.status === exp.status && exp.flags.every((f) => raised.includes(f)),
    falseApproval: verdict.status === 'verified' && exp.status !== 'verified', raised, ms, verdict, fieldsRight: right, fieldsTotal: total, perField,
  };
}

export async function benchConsent(): Promise<string> {
  const r = await fetch('/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purposes: ['kyc_verification', 'registry_lookup'], language: 'en' }) });
  return (await r.json()).id;
}
