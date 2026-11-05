import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGstin, isValidGstin, coerceGstin } from '../src/lib/gstin.ts';

const registry = new Set(['19EOGXH4115Y1ZL', '27QHJXK0658U1ZL', '08YKZXS5189L1ZO', '27XUIXG0767D1ZP', '37NBLXS1145E1ZU']);
const has = (g: string) => registry.has(g);

test('valid dataset GSTINs pass the checksum', () => {
  for (const g of registry) assert.ok(isValidGstin(g), g);
});

test('K02: OCR reads 0 in a PAN letter slot; the format fixes it', () => {
  const r = readGstin('19E0GXH4115Y1ZL', has);
  assert.equal(r.status, 'valid');
  assert.equal(r.status === 'valid' && r.gstin, '19EOGXH4115Y1ZL');
});

test('K03 and K12: OCR reads O for 0 and 7 for Z', () => {
  assert.equal(coerceGstin('27XUIXGO767D1ZP'), '27XUIXG0767D1ZP');
  const r = readGstin('37NBLXS1145E17U', has);
  assert.ok(r.status === 'valid' && r.gstin === '37NBLXS1145E1ZU');
});

test('K10: I/J misread is recovered by checksum plus registry', () => {
  const r = readGstin('27QHIXK0658U1ZL', has);
  assert.equal(r.status, 'recovered');
  assert.equal(r.status === 'recovered' && r.gstin, '27QHJXK0658U1ZL');
});

test('K06: a wrong digit printed on the certificate stays invalid', () => {
  const r = readGstin('08YKZXS8189L170', has);
  assert.equal(r.status, 'invalid');
});
