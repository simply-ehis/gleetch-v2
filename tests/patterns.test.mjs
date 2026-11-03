import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, getPatternById } from '../src/patterns/registry.js';
import { prng } from '../src/core/rng.js';
import { createMockContext } from './helpers/mock-canvas.mjs';

test('registry has 160 patterns (100 core + 40 base additions) with no duplicate ids', () => {
  assert.equal(PATTERNS.length, 160);
  const seen = new Set();
  for (const p of PATTERNS) {
    assert.ok(!seen.has(p.id), `duplicate pattern id: ${p.id}`);
    seen.add(p.id);
  }
});

test('every pattern has a family tag', () => {
  for (const p of PATTERNS) assert.ok(p.family, `${p.id} has no family`);
});

test('getPatternById finds a pattern that exists and returns undefined for one that does not', () => {
  const knownId = PATTERNS[0].id;
  assert.equal(getPatternById(knownId).id, knownId);
  assert.equal(getPatternById('this_id_does_not_exist'), undefined);
});

test('every pattern draws without throwing and leaves no NaN in the buffer', () => {
  const W = 32, H = 32;
  for (const p of PATTERNS) {
    const ctx = createMockContext(W, H);
    p.fn(ctx, W, H, prng(123));
    const data = ctx.getImageData(0, 0, W, H).data;
    for (let i = 0; i < data.length; i++) assert.ok(!Number.isNaN(data[i]), `${p.id} (${p.family}): NaN in output`);
  }
});
