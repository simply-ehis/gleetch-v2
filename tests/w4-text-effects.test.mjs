import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEffectsFor } from '../src/effects/registry.js';
import { prng } from '../src/core/rng.js';

const text = 'The old king wrote his name in stone and left it for the sea to read.';
const astral = '\u{1D400}\u{13000}\u{10000}';
const combined = text + astral;

function loneSurrogates(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xDC00 && d <= 0xDFFF) i++; else n++;
    } else if (c >= 0xDC00 && c <= 0xDFFF) n++;
  }
  return n;
}

test('new text effects are registered', () => {
  const txt = getEffectsFor('text');
  const ids = txt.map((e) => e.id);
  for (const id of ['runify', 'oghamize', 'hieroglyph', 'cuneiform', 'linearB', 'phoenician', 'mayanNumerals', 'meltDown', 'riseUp', 'inkBleed', 'frameCrawl', 'weathered', 'redact', 'fade', 'boustrophedon', 'concreteShape', 'cipherShift', 'ornamentBorder']) {
    assert.ok(ids.includes(id), `${id} not registered`);
  }
});

test('new text effects are identity at intensity 0', () => {
  const txt = getEffectsFor('text');
  const newIds = ['runify', 'oghamize', 'hieroglyph', 'cuneiform', 'linearB', 'phoenician', 'mayanNumerals', 'meltDown', 'riseUp', 'inkBleed', 'frameCrawl', 'weathered', 'redact', 'fade', 'boustrophedon', 'concreteShape', 'cipherShift', 'ornamentBorder'];
  for (const e of txt) {
    if (newIds.includes(e.id)) {
      const out = e.fn(text, 0, prng(42), {});
      assert.equal(out, text, `${e.id} not identity at intensity 0`);
    }
  }
});

test('new text effects do not break astral characters', () => {
  const txt = getEffectsFor('text');
  const newIds = ['runify', 'oghamize', 'hieroglyph', 'cuneiform', 'linearB', 'phoenician', 'mayanNumerals', 'meltDown', 'riseUp', 'inkBleed', 'frameCrawl', 'weathered', 'redact', 'fade', 'boustrophedon', 'concreteShape', 'cipherShift', 'ornamentBorder'];
  for (const e of txt) {
    if (newIds.includes(e.id)) {
      for (let s = 1; s <= 50; s++) {
        const out = e.fn(combined, 0.5, prng(s), {});
        assert.equal(loneSurrogates(out), 0, `${e.id} broke astral characters at seed ${s}`);
      }
    }
  }
});

test('new text effects produce valid output', () => {
  const txt = getEffectsFor('text');
  const newIds = ['runify', 'oghamize', 'hieroglyph', 'cuneiform', 'linearB', 'phoenician', 'mayanNumerals', 'meltDown', 'riseUp', 'inkBleed', 'frameCrawl', 'weathered', 'redact', 'fade', 'boustrophedon', 'concreteShape', 'cipherShift', 'ornamentBorder'];
  for (const e of txt) {
    if (newIds.includes(e.id)) {
      const out = e.fn(text, 0.5, prng(42), {});
      assert.ok(typeof out === 'string', `${e.id} did not return a string`);
      assert.ok(out.length > 0, `${e.id} returned empty string`);
    }
  }
});

test('script effects respect cipher mode', () => {
  const txt = getEffectsFor('text');
  const runify = txt.find((e) => e.id === 'runify');
  const out1 = runify.fn('abc', 1, prng(42), { mode: 'cipher' });
  const out2 = runify.fn('abc', 1, prng(42), { mode: 'cipher' });
  assert.equal(out1, out2, 'cipher mode should be deterministic');
});

test('cipherShift shifts letters', () => {
  const txt = getEffectsFor('text');
  const cipher = txt.find((e) => e.id === 'cipherShift');
  const out = cipher.fn('abc', 1, prng(42), {});
  assert.notEqual(out, 'abc', 'cipherShift should change letters');
});
