import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPORT_SCALES, resolveExportDims } from '../src/core/render-still.js';

test('export scales the current format dims, preserving aspect', () => {
  // 16:9 composition stays 16:9 at 3x (was: forced to 9:16 phone preset)
  const wide = resolveExportDims('x3', 640, 360);
  assert.deepEqual([wide.W, wide.H], [1920, 1080]);
  assert.equal(wide.capped, false);
  // square stays square
  const sq = resolveExportDims('x2', 512, 512);
  assert.deepEqual([sq.W, sq.H], [1024, 1024]);
  // portrait stays portrait
  const port = resolveExportDims('x4', 512, 1024);
  assert.deepEqual([port.W, port.H], [2048, 4096]);
  assert.ok(port.H > port.W, 'portrait orientation lost');
});

test('export long edge caps at 4096', () => {
  const big = resolveExportDims('x4', 2048, 1152);
  assert.equal(big.W, 4096);
  assert.equal(big.H, 2304);
  assert.equal(big.capped, true);
  // small scale unaffected by the cap
  const small = resolveExportDims('x1', 2048, 1152);
  assert.deepEqual([small.W, small.H], [2048, 1152]);
  assert.equal(small.capped, false);
});

test('export falls back sane on unknown scale and degenerate input', () => {
  const fallback = resolveExportDims('phone', 512, 512);
  const def = EXPORT_SCALES[2];
  assert.deepEqual([fallback.W, fallback.H], [512 * def.scale, 512 * def.scale]);
  const zero = resolveExportDims('x2', 0, 0);
  assert.ok(zero.W >= 64 && zero.H >= 64, 'degenerate dims must stay usable');
});
