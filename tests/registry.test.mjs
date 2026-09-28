import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_EFFECTS, getEffectsFor, getEffectById, applyEffectChain, applyVideoEffectChain, buildWebCSS, randomEffectSelection } from '../src/effects/registry.js';
import { IMAGE_PRESETS, TEXT_PRESETS, AUDIO_PRESETS, WEB_PRESETS } from '../src/effects/presets.js';
import { prng } from '../src/core/rng.js';

function makeImageBuf(W, H, v = 110) {
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < buf.length; i += 4) { buf[i] = v; buf[i + 1] = v; buf[i + 2] = v; buf[i + 3] = 255; }
  return buf;
}

test('every image/video effect runs without throwing and produces valid pixel data', () => {
  const W = 20, H = 20;
  for (const e of getEffectsFor('image')) {
    if (e.id.startsWith('overlay')) continue; // needs DOM, covered in overlay.test.mjs
    const out = e.needsChannel
      ? e.fn(makeImageBuf(W, H), W, H, 0.6, 'brightness', prng(5))
      : e.fn(makeImageBuf(W, H), W, H, 0.6, prng(5));
    assert.equal(out.length, W * H * 4, `${e.id}: wrong output length`);
    for (let i = 0; i < out.length; i++) assert.ok(!Number.isNaN(out[i]), `${e.id}: NaN at index ${i}`);
  }
});

test('every audio effect runs without throwing and produces valid samples', () => {
  const ch = new Float32Array(300).fill(0.2);
  for (const e of getEffectsFor('audio')) {
    const out = e.fn(ch, 44100, 0.6, prng(5));
    for (let i = 0; i < out.length; i++) assert.ok(!Number.isNaN(out[i]), `${e.id}: NaN at index ${i}`);
  }
});

test('every text effect runs without throwing and produces a clean string', () => {
  for (const e of getEffectsFor('text')) {
    const out = e.fn('The quick brown fox jumps over the lazy dog 123.', 0.6, prng(5));
    assert.equal(typeof out, 'string', `${e.id}: did not return a string`);
    assert.ok(!out.includes('undefined'), `${e.id}: output contains literal "undefined"`);
    assert.ok(!out.includes('\uFFFD'), `${e.id}: output contains a replacement character (broken glyph)`);
  }
});

test('every web effect returns a valid {keyframes?, animation?, rules?} shape', () => {
  for (const e of getEffectsFor('web')) {
    const r = e.fn(0.6, prng(5));
    assert.equal(typeof r, 'object', `${e.id}: did not return an object`);
    assert.ok(r.keyframes || r.animation || r.rules, `${e.id}: returned an empty contribution`);
  }
});

// Regression test: 'stutter' and 'noiseInject' exist in both TEXT_EFFECTS
// and AUDIO_EFFECTS. getEffectById() used to resolve to whichever came
// first in ALL_EFFECTS regardless of caller — meaning an audio chain
// calling 'stutter' would silently run the TEXT version on a Float32Array
// and throw. Fixed by making lookup media-type-scoped.
test('media-type-scoped lookup resolves id collisions correctly (stutter, noiseInject)', () => {
  const audioOut = applyEffectChain(new Float32Array(100).fill(0.3), ['stutter', 'noiseInject'], { mediaType: 'audio', sampleRate: 44100, intensity: 0.5 }, prng(1));
  assert.equal(audioOut.constructor.name, 'Float32Array');
  const textOut = applyEffectChain('hello world test', ['stutter', 'noiseInject'], { mediaType: 'text', intensity: 0.5 }, prng(1));
  assert.equal(typeof textOut, 'string');
  assert.ok(!textOut.includes('undefined'));
});

test('getEffectById is unambiguous when scoped to a media type', () => {
  assert.deepEqual(getEffectById('stutter', 'audio').mediaTypes, ['audio']);
  assert.deepEqual(getEffectById('stutter', 'text').mediaTypes, ['text']);
});

test('no duplicate {id, mediaType} pairs exist in the registry', () => {
  const seen = new Set();
  for (const e of ALL_EFFECTS) {
    for (const mt of e.mediaTypes) {
      const key = `${e.id}|${mt}`;
      assert.ok(!seen.has(key), `duplicate effect: id=${e.id} mediaType=${mt}`);
      seen.add(key);
    }
  }
});

test('every effect has a category', () => {
  for (const e of ALL_EFFECTS) assert.ok(e.category, `${e.id} has no category`);
});

test('all preset effect ids exist and are tagged for their media type', () => {
  for (const [name, presets, mt] of [['IMAGE', IMAGE_PRESETS, 'image'], ['TEXT', TEXT_PRESETS, 'text'], ['AUDIO', AUDIO_PRESETS, 'audio'], ['WEB', WEB_PRESETS, 'web']]) {
    const valid = new Set(getEffectsFor(mt).map((e) => e.id));
    for (const [key, preset] of Object.entries(presets)) {
      for (const id of preset.algos) assert.ok(valid.has(id), `${name}.${key}: '${id}' not tagged for '${mt}'`);
      assert.ok(preset.intensity >= 0 && preset.intensity <= 1, `${name}.${key}: intensity out of range`);
    }
  }
});

test('applyEffectChain is deterministic for a given seed', () => {
  const chain = ['pixelSort', 'chanShift', 'gaussianBlur'];
  const ctx = { mediaType: 'image', W: 16, H: 16, intensity: 0.5, channel: 'brightness' };
  const a = applyEffectChain(makeImageBuf(16, 16), chain, ctx, prng(123));
  const b = applyEffectChain(makeImageBuf(16, 16), chain, ctx, prng(123));
  assert.deepEqual(Array.from(a), Array.from(b));
});

// Regression test for the video "style pick vs per-frame glitch" fix:
// duotone/hueRotate/lensWarp/lineDistortion pick a one-time
// style choice via rng() (hue, direction, position) and must hold that
// choice for an entire clip. Without stableAcrossFrames they'd re-roll
// every frame and flicker between random picks 30 times a second.
// 96x96 (not 16x16) is deliberate: the pareidolia displacement family uses
// per-pixel tension fields that can exceed the whole image near feature
// centers at high default chaos values — at 16px every sample clamps to an
// image edge and the output saturates to the same smear regardless of clip
// seed, which would make "varies across clips" untestable. At realistic
// sizes the corners stay below the clamp and per-clip variation shows.
function makeVariedBuf(W, H) {
  // A uniform solid color is degenerate for testing stableAcrossFrames
  // effects, for two different reasons: hueRotate has no hue to rotate on
  // gray, and lensWarp/lineDistortion move pixel POSITIONS, which is
  // invisible when every position holds an identical value. This gradient
  // gives every effect something real to act on.
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      buf[i] = (x * 255) / W | 0;
      buf[i + 1] = (y * 255) / H | 0;
      buf[i + 2] = 128;
      buf[i + 3] = 255;
    }
  }
  return buf;
}

test('stableAcrossFrames effects hold steady within a clip but vary across clips', () => {
  const ctx = { W: 96, H: 96, intensity: 0.6, channel: 'brightness' };
  for (const id of ['duotone', 'hueRotate', 'lensWarp', 'lineDistortion', 'matrixColor']) {
    const clipSeed = 555;
    const frame1 = applyVideoEffectChain(makeVariedBuf(96, 96), [id], ctx, clipSeed, clipSeed + 100);
    const frame2 = applyVideoEffectChain(makeVariedBuf(96, 96), [id], ctx, clipSeed, clipSeed + 9000);
    assert.deepEqual(Array.from(frame1), Array.from(frame2), `${id}: flickered within the same clip`);

    // Check that at least one pair among several clip seeds differs — the specific pair
    // 111 vs 999 was chosen arbitrarily and can coincidentally collide for a given PRNG
    // (e.g. both hueRotate directions fall on same side of 0.5). Test the property, not the pair.
    const seeds = [11, 42, 1337, 9999, 12345];
    let varied = false;
    for (let i = 0; i < seeds.length; i++) {
      for (let j = i + 1; j < seeds.length; j++) {
        const a = applyVideoEffectChain(makeVariedBuf(96, 96), [id], ctx, seeds[i], seeds[i] + 100);
        const b = applyVideoEffectChain(makeVariedBuf(96, 96), [id], ctx, seeds[j], seeds[j] + 100);
        if (JSON.stringify(Array.from(a)) !== JSON.stringify(Array.from(b))) { varied = true; break; }
      }
      if (varied) break;
    }
    assert.ok(varied, `${id}: did not vary across different clips/reroll (tested ${seeds.join(',')})`);
  }
});

test('buildWebCSS merges multiple animations into one combined shorthand', () => {
  const css = buildWebCSS(['cssScanlines', 'cssRgbSplit', 'cssGlitchSlice'], 0.6, prng(42));
  assert.ok(css.includes('animation:gleetch-slice'), 'expected combined animation shorthand referencing gleetch-slice');
  assert.ok(!css.includes('undefined') && !css.includes('NaN'));
});

test('randomEffectSelection only returns ids valid for the requested media type', () => {
  for (const mt of ['image', 'text', 'audio', 'web', 'video']) {
    const valid = new Set(getEffectsFor(mt).map((e) => e.id));
    const selection = randomEffectSelection(mt, prng(7));
    for (const id of selection) assert.ok(valid.has(id), `${mt} shuffle returned invalid id '${id}'`);
  }
});

test('randomEffectSelection never repeats an id within a chain', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const mt of ['image', 'text', 'audio', 'web', 'video']) {
      const selection = randomEffectSelection(mt, prng(seed), { signatureChance: 0.5 });
      assert.equal(new Set(selection).size, selection.length, `${mt} seed ${seed} returned duplicates: ${selection.join(',')}`);
    }
  }
});

test('randomEffectSelection respects hard excludes and rerolls can keep useful effects', () => {
  const a = randomEffectSelection('image', prng(5));
  for (let seed = 1; seed <= 30; seed++) {
    const b = randomEffectSelection('image', prng(seed), { exclude: a });
    assert.notDeepEqual(b, a, `seed ${seed} returned the excluded chain`);
  }
  const all = getEffectsFor('image').map((e) => e.id);
  assert.deepEqual(randomEffectSelection('image', prng(3), { exclude: all }), []);
});

test('randomEffectSelection changes an identical reroll without shrinking the palette', () => {
  const current = ['pixelSort', 'chanShift', 'gaussianBlur'];
  const next = randomEffectSelection('image', prng(5), { previousChain: current, signatureChance: 1 });
  assert.notDeepEqual(next, current, 'reroll should not repeat the same ordered chain');
  assert.ok(next.some((id) => current.includes(id)), 'reroll should be allowed to retain complementary current effects');
});

test('randomEffectSelection signature chains are valid and non-heavy for video', () => {
  const valid = (mt) => new Set(getEffectsFor(mt).map((e) => e.id));
  for (let seed = 1; seed <= 200; seed++) {
    const pick = randomEffectSelection('video', prng(seed), { signatureChance: 1 });
    const ok = valid('video');
    for (const id of pick) assert.ok(ok.has(id), `video signature contained unknown id '${id}'`);
    assert.ok(pick.every((id) => getEffectById(id, 'video').realtimeSafe !== false), `video signature contained a heavy effect`);
  }
});

test('randomEffectSelection stays within minCount/maxCount bounds', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const selection = randomEffectSelection('image', prng(seed), { minCount: 1, maxCount: 6 });
    assert.ok(selection.length >= 1 && selection.length <= 6, `chain length ${selection.length} out of bounds`);
  }
});
