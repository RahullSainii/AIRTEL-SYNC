import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hamming } from '../src/lib/gstin.ts';
import { parseDocument, type OcrLine } from '../src/lib/kyc/parse.ts';
import { verifyKyc, type VerifyRegistry } from '../src/lib/kyc/verify.ts';
import type { DocType, ExtractedDoc, GstinRecord, UdyamRecord } from '../src/lib/types.ts';

const key = JSON.parse(fs.readFileSync('src/data/kyc-answer-key.json', 'utf8'));
const ocr: Record<string, { lines: OcrLine[]; confidence: number }> = JSON.parse(fs.readFileSync('tests/fixtures/ocr-lines.json', 'utf8'));
const gst = new Map((JSON.parse(fs.readFileSync('src/data/generated/gstin-registry.json', 'utf8')) as GstinRecord[]).map((r) => [r.gstin, r]));
const ud = new Map((JSON.parse(fs.readFileSync('src/data/generated/udyam-registry.json', 'utf8')) as UdyamRecord[]).map((r) => [r.udyamNumber, r]));
const registry: VerifyRegistry = {
  id: 'test',
  gstinExists: (g) => gst.has(g),
  lookupGstin: async (g) => gst.get(g) ?? null,
  lookupUdyam: async (n) => ud.get(n) ?? null,
  nearestGstin: async (g) => [...gst.values()].find((r) => hamming(r.gstin, g) === 1) ?? null,
  findUdyamByName: async (name, state) => [...ud.values()].filter((r) => r.enterpriseName === name && (!state || r.state === state)),
};

for (const app of Object.keys(key)) {
  test(`${app}: ${key[app].expected.problem}`, async () => {
    const docs: Partial<Record<DocType, ExtractedDoc>> = {};
    for (const type of ['gst_certificate', 'udyam_certificate', 'signatory_id', 'address_proof'] as DocType[]) {
      const o = ocr[`${app}_${type}`];
      if (o) docs[type] = parseDocument(o.lines, type, o.confidence);
    }
    const v = await verifyKyc({ docs }, registry);
    assert.equal(v.status, key[app].expected.status, JSON.stringify(v.checks.filter((c) => c.result !== 'pass')));
    const raised = v.checks.filter((c) => c.result !== 'pass').map((c) => c.id);
    for (const f of key[app].expected.flags) assert.ok(raised.includes(f), `${f} not raised`);
    for (const c of v.checks.filter((c) => c.result !== 'pass')) assert.ok(c.why && c.fix, `${c.id} lacks why/fix`);
  });
}
