import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blendWith, luminanceMask, radialMask, noiseMask } from '../src/core/compose.js';
import { CURATED_PALETTES, generateHarmony, paletteFromHue } from '../src/core/palette.js';
import { getEffectsFor } from '../src/effects/registry.js';
import { prng } from '../src/core/rng.js';

const N = 64 * 64 * 4;
const testBuf = new Uint8ClampedArray(N);
for (let i = 0; i < N; i++) testBuf[i] = (i * 7 + 13) % 256;

test('blendWith: opacity 0 returns base', () => {
  const fx = new Uint8ClampedArray(N).fill(255);
  const out = blendWith(testBuf, fx, { mode: 'screen', opacity: 0 });
  assert.deepEqual(out, testBuf);
});

test('blendWith: opacity 1 returns fx', () => {
  const fx = new Uint8ClampedArray(N).fill(255);
  const out = blendWith(testBuf, fx, { mode: 'screen', opacity: 1 });
  assert.deepEqual(out, fx);
});

test('blendWith: screen mode brightens', () => {
  const base = new Uint8ClampedArray(4).fill(100);
  const fx = new Uint8ClampedArray(4).fill(100);
  const out = blendWith(base, fx, { mode: 'screen', opacity: 0.5 });
  assert.ok(out[0] > 100, 'screen should brighten');
});

test('blendWith: multiply mode darkens', () => {
  const base = new Uint8ClampedArray(4).fill(200);
  const fx = new Uint8ClampedArray(4).fill(200);
  const out = blendWith(base, fx, { mode: 'multiply', opacity: 0.5 });
  assert.ok(out[0] < 200, 'multiply should darken');
});

test('luminanceMask: returns Float32Array of correct length', () => {
  const mask = luminanceMask(testBuf, 64, 64);
  assert.equal(mask.length, 64 * 64);
  assert.ok(mask[0] >= 0 && mask[0] <= 1);
});

test('radialMask: center is 1, edges are 0', () => {
  const mask = radialMask(64, 64);
  assert.ok(mask[32 * 64 + 32] > 0.9, 'center should be ~1');
  assert.ok(mask[0] < 0.1, 'corner should be ~0');
});

test('noiseMask: returns values in 0..1', () => {
  const mask = noiseMask(64, 64, 42);
  for (let i = 0; i < mask.length; i++) {
    assert.ok(mask[i] >= 0 && mask[i] <= 1);
  }
});

test('CURATED_PALETTES: has at least 6 palettes', () => {
  assert.ok(CURATED_PALETTES.length >= 6);
});

test('generateHarmony: analogous returns 3 hues', () => {
  const hues = generateHarmony(120, 'analogous');
  assert.equal(hues.length, 3);
});

test('generateHarmony: complementary returns 2 hues', () => {
  const hues = generateHarmony(120, 'complementary');
  assert.equal(hues.length, 2);
});

test('paletteFromHue: returns RGB arrays', () => {
  const palette = paletteFromHue(120, 'triadic');
  assert.equal(palette.length, 3);
  for (const c of palette) {
    assert.equal(c.length, 3);
    for (const v of c) assert.ok(v >= 0 && v <= 255);
  }
});

test('new aesthetic effects are registered', () => {
  const img = getEffectsFor('image');
  const ids = img.map((e) => e.id);
  for (const id of ['bloom', 'lightLeak', 'vignette', 'gradientMap', 'splitTone', 'iridescence', 'filmGrain', 'paperFiber', 'dustScratch', 'meshGradient', 'frostedGlass', 'tiltShift']) {
    assert.ok(ids.includes(id), `${id} not registered`);
  }
});

test('new effects are realtimeSafe', () => {
  const img = getEffectsFor('image');
  for (const e of img) {
    if (['bloom', 'lightLeak', 'vignette', 'gradientMap', 'splitTone', 'iridescence', 'filmGrain', 'paperFiber', 'dustScratch', 'meshGradient', 'frostedGlass', 'tiltShift'].includes(e.id)) {
      assert.ok(e.realtimeSafe !== false, `${e.id} should be realtimeSafe`);
    }
  }
});

test('new effects are identity at intensity 0', () => {
  const img = getEffectsFor('image');
  const newIds = ['bloom', 'lightLeak', 'vignette', 'gradientMap', 'splitTone', 'iridescence', 'filmGrain', 'paperFiber', 'dustScratch', 'meshGradient', 'frostedGlass', 'tiltShift'];
  for (const e of img) {
    if (newIds.includes(e.id)) {
      const out = e.fn(testBuf, 64, 64, 0, prng(42), {});
      assert.deepEqual(out, testBuf, `${e.id} not identity at intensity 0`);
    }
  }
});

test('new effects produce valid pixel data', () => {
  const img = getEffectsFor('image');
  const newIds = ['bloom', 'lightLeak', 'vignette', 'gradientMap', 'splitTone', 'iridescence', 'filmGrain', 'paperFiber', 'dustScratch', 'meshGradient', 'frostedGlass', 'tiltShift'];
  for (const e of img) {
    if (newIds.includes(e.id)) {
      const out = e.fn(testBuf, 64, 64, 0.5, prng(42), {});
      assert.equal(out.length, N);
      for (let i = 0; i < out.length; i++) {
        assert.ok(out[i] >= 0 && out[i] <= 255, `${e.id} produced out-of-range value at index ${i}`);
      }
    }
  }
});
