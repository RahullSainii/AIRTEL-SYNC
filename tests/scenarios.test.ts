import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, runScenario } from '../src/lib/scenarios.ts';

for (const s of SCENARIOS) {
  test(`${s.id} ${s.title}: ${s.expect}`, () => {
    const r = runScenario(s);
    assert.ok(r.pass, JSON.stringify(r.rec));
  });
}
