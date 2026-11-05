// End-to-end KYC benchmark on the specimen pack: OCR -> parse -> GSTIN checks -> registry -> verdict.
// Run with: node --experimental-strip-types scripts/kyc-benchmark.ts [--write-fixture]
import fs from 'node:fs';
import path from 'node:path';
import { createWorker } from 'tesseract.js';
import { hamming } from '../src/lib/gstin.ts';
import { parseDocument, type OcrLine } from '../src/lib/kyc/parse.ts';
import { verifyKyc, type VerifyRegistry } from '../src/lib/kyc/verify.ts';
import type { DocType, ExtractedDoc, GstinRecord, UdyamRecord } from '../src/lib/types.ts';

const DIR = 'YTL_TrackA_Udyam_Digital_Data/kyc_documents';
const key = JSON.parse(fs.readFileSync('src/data/kyc-answer-key.json', 'utf8'));
const gst = new Map((JSON.parse(fs.readFileSync('src/data/generated/gstin-registry.json', 'utf8')) as GstinRecord[]).map((r) => [r.gstin, r]));
const ud = new Map((JSON.parse(fs.readFileSync('src/data/generated/udyam-registry.json', 'utf8')) as UdyamRecord[]).map((r) => [r.udyamNumber, r]));
export const registry: VerifyRegistry = {
  id: 'mock-csv-v1',
  gstinExists: (g) => gst.has(g),
  lookupGstin: async (g) => gst.get(g) ?? null,
  lookupUdyam: async (n) => ud.get(n) ?? null,
  nearestGstin: async (g) => [...gst.values()].find((r) => hamming(r.gstin, g) === 1) ?? null,
  findUdyamByName: async (name, state) => [...ud.values()].filter((r) => r.enterpriseName === name && (!state || r.state === state)),
};

const worker = await createWorker('eng', 1, {
  langPath: path.resolve('public/ocr/lang'),
  gzip: true,
});
const fixture: Record<string, { lines: OcrLine[]; confidence: number }> = {};
const rows: string[] = [];
let fieldsRight = 0, fieldsTotal = 0, verdictsRight = 0;
const times: number[] = [];
for (const app of Object.keys(key)) {
  const t0 = Date.now();
  const docs: Partial<Record<DocType, ExtractedDoc>> = {};
  for (const type of ['gst_certificate', 'udyam_certificate', 'signatory_id', 'address_proof'] as DocType[]) {
    const file = `${DIR}/${app}_${type}.png`;
    if (!fs.existsSync(file)) continue;
    const { data } = await worker.recognize(file, { rotateAuto: true }, { text: true, blocks: true });
    const lines: OcrLine[] = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.map((l) => ({ text: l.text.trim(), confidence: l.confidence }))));
    fixture[`${app}_${type}`] = { lines, confidence: data.confidence };
    docs[type] = parseDocument(lines, type, data.confidence);
  }
  const verdict = await verifyKyc({ docs }, registry);
  const ms = Date.now() - t0;
  times.push(ms);
  const exp = key[app].expected;
  const raised = verdict.checks.filter((c) => c.result !== 'pass' && c.result !== 'info').map((c) => c.id);
  const ok = verdict.status === exp.status && exp.flags.every((f: string) => raised.includes(f));
  if (ok) verdictsRight++;
  for (const [type, fields] of Object.entries(key[app].fields) as [DocType, Record<string, string | null>][]) {
    for (const [name, want] of Object.entries(fields)) {
      if (docs[type] && docs[type]!.ocrConfidence < 60) { fieldsTotal++; continue; }
      let got = docs[type]?.fields[name]?.value ?? null;
      if (name === 'gstin' && got) got = got.toUpperCase();
      fieldsTotal++;
      const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (norm(got) === norm(want) || (name === 'gstin' && verdict.gstinUsed && want && verdict.registry.gstin?.gstin === want)) fieldsRight++;
    }
  }
  rows.push(`${app}  ${verdict.status.padEnd(8)} expected ${exp.status.padEnd(8)} ${ok ? 'OK  ' : 'MISS'} ${ms}ms  raised: ${raised.join(', ') || '-'}`);
}
await worker.terminate();
console.log(rows.join('\n'));
times.sort((a, b) => a - b);
console.log(`\nVerdicts ${verdictsRight}/${rows.length}; field accuracy ${fieldsRight}/${fieldsTotal} (${((fieldsRight / fieldsTotal) * 100).toFixed(1)}%)`);
console.log(`Upload-to-verdict per applicant (4 docs): median ${times[Math.floor(times.length / 2)]}ms, worst ${times[times.length - 1]}ms`);
if (process.argv.includes('--write-fixture')) fs.writeFileSync('tests/fixtures/ocr-lines.json', JSON.stringify(fixture));
