// Pure motion functions of (t, seed). No state, no side effects.
// Each returns a modulation value that effects read from env.motion.

export function drift(t, seed, speed = 0.1) {
  return Math.sin(t * speed * Math.PI * 2 + seed) * 0.5 + 0.5;
}

export function pulse(t, seed, speed = 0.5) {
  return Math.sin(t * speed * Math.PI * 2 + seed) * 0.5 + 0.5;
}

export function sweep(t, seed, speed = 0.2) {
  return (t * speed + seed) % 1;
}

export function burst(t, seed, speed = 1) {
  const phase = (t * speed + seed) % 1;
  return phase < 0.1 ? phase / 0.1 : phase > 0.9 ? (1 - phase) / 0.1 : 0;
}

export function breathe(t, seed, speed = 0.15) {
  return Math.sin(t * speed * Math.PI * 2 + seed) * 0.5 + 0.5;
}

export function steps(t, seed, speed = 0.5) {
  return ((Math.floor((t * speed + seed) * 4) / 4) % 1 + 1) % 1;
}

export function scrub(t, seed, speed = 0.1) {
  return Math.min(1, Math.max(0, (t * speed + seed) % 1));
}

export function pingpong(t, seed, speed = 0.2) {
  const p = (t * speed + seed) % 1;
  return p < 0.5 ? p * 2 : (1 - p) * 2;
}

export function orbit(t, seed, speed = 0.3) {
  return (Math.sin(t * speed * Math.PI * 2 + seed) + Math.cos(t * speed * Math.PI * 2 + seed)) * 0.25 + 0.5;
}

export const MOTION_KINDS = { drift, pulse, sweep, burst, breathe, steps, scrub, pingpong, orbit };

export function getMotionValue(kind, t, seed, speed = 1) {
  const fn = MOTION_KINDS[kind] || drift;
  return fn(t, seed, speed);
}
