import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heuristicExtract } from '../src/lib/advisor/fallback.ts';
import { mergeProfile } from '../src/lib/advisor/merge.ts';
import { recommend } from '../src/lib/engine.ts';
import type { Profile } from '../src/lib/types.ts';

function converse(turns: string[]): Profile {
  let p: Profile = {};
  for (const t of turns) {
    const prev = recommend(p);
    p = mergeProfile(p, heuristicExtract(t, prev.status === 'need_info' ? prev.missing[0] : null));
  }
  return p;
}

test('one-line English description is enough for a quote', () => {
  const p = converse(['I run a pharmacy in Jaipur with 5 staff. We have GST. I need internet and CCTV.', '1 location']);
  const r = recommend(p);
  assert.equal(r.status, 'ok');
  assert.ok(r.status === 'ok' && r.quote.monthly === 1397);
});

test('Hinglish with bare answers to follow-up questions', () => {
  const p = converse(['Delhi mein dental clinic hai, 6 log, GST hai, internet aur WhatsApp chahiye', '1']);
  assert.equal(p.city, 'Delhi');
  assert.equal(p.employees, 6);
  assert.equal(p.hasGstin, true);
  assert.equal(recommend(p).status, 'ok');
});

test('Hindi script, no GST', () => {
  const p = converse(['मेरी लखनऊ में किराना दुकान है, 2 लोग काम करते हैं, GST नहीं है', '1 location']);
  assert.equal(p.businessType, 'Kirana store');
  assert.equal(p.city, 'Lucknow');
  assert.equal(p.hasGstin, false);
  assert.equal(heuristicExtract('मेरी लखनऊ में किराना दुकान है').language, 'hi');
});

test('quick-reply chips answer the pending question', () => {
  const p = converse(['Bakery', '2–5', '1 location', 'Indore', 'Yes, I have a GSTIN']);
  assert.equal(p.employees, 4);
  assert.equal(p.sites, 1);
  assert.equal(p.hasGstin, true);
  assert.equal(recommend(p).status, 'ok');
});

test('a chain is read as multi-site', () => {
  const p = converse(['We have 3 restaurants in Mumbai, 30 staff, GST registered.']);
  assert.equal(p.sites, 3);
  assert.equal(p.employees, 30);
  const r = recommend(p);
  assert.ok(r.status === 'ok' && r.quote.monthly === 5994);
});
