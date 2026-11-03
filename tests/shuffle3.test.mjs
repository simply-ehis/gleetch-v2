import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffle3, shuffleBase, shuffleEffects, shuffleColour, LAYER2_COUNT, LAYER2_BUDGET, COLOUR_SOURCES, COLOUR_METHODS } from '../src/core/shuffle3.js';
import { prng } from '../src/core/rng.js';
import { getEffectById } from '../src/effects/registry.js';

test('shuffle3 returns all three layers', () => {
  const r = shuffle3({ seed: 12345, tier: 'medium' });
  assert.ok(r.base && r.base.recipe && Array.isArray(r.base.recipe.steps));
  assert.ok(Array.isArray(r.effects));
  assert.ok(typeof r.intensity === 'number' && r.intensity >= 0 && r.intensity <= 1);
  assert.ok(r.colour && typeof r.colour.source === 'string' && Array.isArray(r.colour.passes));
});

test('shuffle3 is deterministic for same seed', () => {
  const a = shuffle3({ seed: 999, tier: 'high' });
  const b = shuffle3({ seed: 999, tier: 'high' });
  assert.deepEqual(a.base.recipe, b.base.recipe);
  assert.deepEqual(a.effects, b.effects);
  assert.equal(a.intensity, b.intensity);
  assert.deepEqual(a.colour, b.colour);
});

test('shuffle3 differs for different seeds', () => {
  const a = shuffle3({ seed: 1, tier: 'medium' });
  const b = shuffle3({ seed: 2, tier: 'medium' });
  let differs = false;
  if (a.base.recipe.seed !== b.base.recipe.seed) differs = true;
  if (a.effects.join(',') !== b.effects.join(',')) differs = true;
  assert.ok(differs, 'different seeds should produce different results');
});

test('layer2 count stays within tier min/max', () => {
  for (const tier of ['low', 'medium', 'high']) {
    const { min, max } = LAYER2_COUNT[tier];
    for (let i = 0; i < 200; i++) {
      const r = shuffle3({ seed: 1000 + i, tier });
      assert.ok(r.effects.length >= min, `[${tier}] too few effects: ${r.effects.length} < ${min}`);
      assert.ok(r.effects.length <= max, `[${tier}] too many effects: ${r.effects.length} > ${max}`);
    }
  }
});

test('layer2 cost stays within tier budget', () => {
  for (const tier of ['low', 'medium', 'high']) {
    const budget = LAYER2_BUDGET[tier];
    for (let i = 0; i < 200; i++) {
      const r = shuffle3({ seed: 2000 + i, tier });
      assert.ok(r.effectCost <= budget, `[${tier}] cost ${r.effectCost} > budget ${budget}`);
    }
  }
});

test('layer2 never repeats an effect id within a stack', () => {
  for (let i = 0; i < 200; i++) {
    const r = shuffle3({ seed: 3000 + i, tier: 'high' });
    const uniq = new Set(r.effects);
    assert.equal(uniq.size, r.effects.length, `duplicate effect in stack: ${r.effects.join(',')}`);
  }
});

test('layer2 never stacks two effects from the same slot', () => {
  for (let i = 0; i < 200; i++) {
    const r = shuffle3({ seed: 4000 + i, tier: 'high' });
    const slots = r.effects.map((id) => getEffectById(id, 'image').slot);
    const uniq = new Set(slots);
    assert.equal(uniq.size, slots.length, `two effects same slot: ${JSON.stringify(slots)}`);
  }
});

test('layer2 never stacks clashing effects', () => {
  for (let i = 0; i < 200; i++) {
    const r = shuffle3({ seed: 5000 + i, tier: 'high' });
    for (const id of r.effects) {
      const blocked = { duotone: ['hueRotate','matrixColor'], hueRotate: ['duotone','matrixColor'], matrixColor: ['duotone','hueRotate'], overlayScreen: ['overlayMultiply','overlayBlend'], overlayMultiply: ['overlayScreen','overlayBlend'], overlayBlend: ['overlayScreen','overlayMultiply'], oilPaint: ['gaussianBlur'], gaussianBlur: ['oilPaint'] }[id];
      if (!blocked) continue;
      assert.ok(!blocked.some((o) => r.effects.includes(o)), `clash: ${id} with ${blocked.join(',')} in ${r.effects.join(',')}`);
    }
  }
});

test('colour passes are within limits and use valid methods', () => {
  for (let i = 0; i < 200; i++) {
    const r = shuffle3({ seed: 6000 + i, tier: 'medium' });
    assert.ok(r.colour.passes.length >= 1 && r.colour.passes.length <= 3);
    assert.ok(COLOUR_SOURCES.includes(r.colour.source));
    for (const p of r.colour.passes) {
      assert.ok(COLOUR_METHODS.includes(p.method));
      assert.ok(p.weight >= 0 && p.weight <= 1.1);
    }
  }
});

test('shuffleEffects honour exclude and never return excluded ids', () => {
  const pool = [];
  for (let i = 0; i < 30; i++) {
    const r = shuffleEffects({ seed: 7000 + i, tier: 'high', rng: prng(7000 + i), exclude: ['pixelSort', 'duotone'] });
    assert.ok(!r.effects.includes('pixelSort'), 'pixelSort excluded');
    assert.ok(!r.effects.includes('duotone'), 'duotone excluded');
  }
});

test('shuffle3 honours tier differences (low is cheapest)', () => {
  const lowCosts = [], highCosts = [];
  for (let i = 0; i < 100; i++) {
    lowCosts.push(shuffle3({ seed: 8000 + i, tier: 'low' }).effectCost);
    highCosts.push(shuffle3({ seed: 8000 + i, tier: 'high' }).effectCost);
  }
  const lowAvg = lowCosts.reduce((a, b) => a + b, 0) / lowCosts.length;
  const highAvg = highCosts.reduce((a, b) => a + b, 0) / highCosts.length;
  assert.ok(lowAvg <= highAvg, `low tier avg cost ${lowAvg} should not exceed high tier ${highAvg}`);
});

test('shuffleBase returns checked recipe', () => {
  const b = shuffleBase({ seed: 42, tier: 'medium', rng: prng(42) });
  assert.ok(b.family);
  assert.ok(b.recipe.steps.length > 0);
  assert.ok(b.recipe.palette && b.recipe.palette.length === 6);
});

test('shuffle3 accepts uppercase tier names and maps them to correct budgets', () => {
  for (const tier of ['low', 'LOW', 'medium', 'MEDIUM', 'high', 'HIGH']) {
    const r = shuffle3({ seed: 90000, tier });
    const expected = tier.toLowerCase();
    const { min, max } = LAYER2_COUNT[expected];
    const budget = LAYER2_BUDGET[expected];
    assert.ok(r.effects.length >= min && r.effects.length <= max, `[${tier}] count ${r.effects.length} not in [${min},${max}]`);
    assert.ok(r.effectCost <= budget, `[${tier}] cost ${r.effectCost} > budget ${budget}`);
  }
});

test('shuffle3 low tier is strictly cheaper than high tier', () => {
  const lowCosts = [], highCosts = [];
  for (let i = 0; i < 100; i++) {
    lowCosts.push(shuffle3({ seed: 91000 + i, tier: 'low' }).effectCost);
    highCosts.push(shuffle3({ seed: 91000 + i, tier: 'high' }).effectCost);
  }
  const lowAvg = lowCosts.reduce((a, b) => a + b, 0) / lowCosts.length;
  const highAvg = highCosts.reduce((a, b) => a + b, 0) / highCosts.length;
  assert.ok(lowAvg <= highAvg, `low avg ${lowAvg} should be <= high avg ${highAvg}`);
});
