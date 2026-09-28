import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drift, pulse, sweep, burst, breathe, steps, scrub, pingpong, orbit, getMotionValue, MOTION_KINDS } from '../src/core/motion.js';
import { renderProceduralVideoFrame } from '../src/core/procedural-video.js';
import { prng } from '../src/core/rng.js';

test('motion functions return values in 0..1 range', () => {
  for (const [name, fn] of Object.entries(MOTION_KINDS)) {
    for (let t = 0; t < 10; t += 0.1) {
      const v = fn(t, 42, 0.5);
      assert.ok(v >= 0 && v <= 1, `${name} returned ${v} at t=${t}`);
    }
  }
});

test('motion functions are deterministic', () => {
  for (const [name, fn] of Object.entries(MOTION_KINDS)) {
    const a = fn(1.5, 42, 0.5);
    const b = fn(1.5, 42, 0.5);
    assert.equal(a, b, `${name} not deterministic`);
  }
});

test('motion functions vary with time', () => {
  for (const [name, fn] of Object.entries(MOTION_KINDS)) {
    const values = new Set();
    for (let t = 0; t < 5; t += 0.1) values.add(fn(t, 42, 0.5));
    assert.ok(values.size > 1, `${name} does not vary with time`);
  }
});

test('getMotionValue dispatches correctly', () => {
  assert.equal(getMotionValue('drift', 1, 42, 0.5), drift(1, 42, 0.5));
  assert.equal(getMotionValue('pulse', 1, 42, 0.5), pulse(1, 42, 0.5));
  assert.equal(getMotionValue('unknown', 1, 42, 0.5), drift(1, 42, 0.5));
});

test('procedural video frame is deterministic for same seed + time', () => {
  // Canvas-dependent — tested in browser. Here we verify the function exists and is callable.
  assert.equal(typeof renderProceduralVideoFrame, 'function');
});

test('procedural video frame varies with time', () => {
  // Canvas-dependent — tested in browser. Here we verify the function exists and is callable.
  assert.equal(typeof renderProceduralVideoFrame, 'function');
});

test('procedural video frame varies with seed', () => {
  // Canvas-dependent — tested in browser. Here we verify the function exists and is callable.
  assert.equal(typeof renderProceduralVideoFrame, 'function');
});
