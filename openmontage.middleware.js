// OpenMontage HTTP middleware for the Gleetch Vite dev server.
// Exposes /health, /effects, /apply, /apply-audio so the OpenMontage Python
// backend can drive Gleetch effects headlessly instead of reimplementing them.
// Only active under `vite` (dev). The production build ships a static SPA
// with no server, so these endpoints are dev-time only.
// Endpoints match newplan.md:
//   GET  /health        -> { ok: true }
//   GET  /effects       -> { effects: [...], patterns: [...] }
//   POST /apply         -> { image: base64 }   (PNG/JPEG in, PNG out)
//   POST /apply-audio   -> { audio: base64 }   (WAV in, WAV out)
import { applyEffectChain, ALL_EFFECTS } from './src/effects/registry.js';
import { prng } from './src/core/rng.js';
import { PATTERNS } from './src/patterns/registry.js';
import pureimage from 'pureimage';
import { Readable, Writable } from 'stream';

const { decodePNGFromStream, decodeJPEGFromStream, encodePNGToStream } = pureimage;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function b64ToBuffer(input) {
  let s = input || '';
  if (s.startsWith('data:')) s = s.split(',')[1];
  return Buffer.from(s, 'base64');
}

function bufferToB64(buf) { return Buffer.from(buf).toString('base64'); }

// Decode a base64 PNG/JPEG into a pureimage Bitmap.
async function decodeImage(b64) {
  const buf = b64ToBuffer(b64);
  return new Promise((resolve, reject) => {
    const stream = Readable.from([buf]);
    decodePNGFromStream(stream, (err, img) => {
      if (err) {
        const s2 = Readable.from([buf]);
        return decodeJPEGFromStream(s2, (err2, img2) => {
          if (err2) reject(new Error('Unable to decode image (PNG/JPEG required)'));
          else resolve(img2);
        });
      }
      resolve(img);
    });
  });
}

function applyImageEffects(bitmap, effectIds, params, intensity, seed) {
  const W = bitmap.width, H = bitmap.height;
  const data = new Uint8ClampedArray(bitmap.data);
  const ctx = { mediaType: 'image', W, H, intensity: intensity ?? 0.5, channel: 0 };
  const out = applyEffectChain(data, effectIds || [], ctx, prng(seed ?? 0), params || {});
  bitmap.data = new Uint8ClampedArray(out);
  return bitmap;
}

function encodeImagePng(bitmap) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = new Writable({
      write(chunk, enc, cb) { chunks.push(chunk); cb(); },
      final(cb) { cb(); },
    });
    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    encodePNGToStream(bitmap, stream, (err) => { if (err) reject(err); });
  });
}

// Minimal WAV (PCM 16-bit) decode / encode so /apply-audio works headlessly.
function decodeWav(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint32(0, false) !== 0x46464952) throw new Error('Not a RIFF WAV');
  if (view.getUint32(8, false) !== 0x45564157) throw new Error('Not WAVE');
  let dataPos = null;
  let pos = 12;
  while (pos < view.byteLength - 8) {
    const id = view.getUint32(pos, false);
    const size = view.getUint32(pos + 4, false);
    if (id === 0x61746164) { dataPos = pos + 8; break; }
    pos += 8 + size;
  }
  if (dataPos === null) throw new Error('No data chunk');
  let sampleRate = 44100, channels = 1, bits = 16;
  pos = 12;
  while (pos < dataPos - 8) {
    const id = view.getUint32(pos, false);
    const size = view.getUint32(pos + 4, false);
    if (id === 0x20746d66) {
      channels = view.getUint16(pos + 10, false);
      sampleRate = view.getUint32(pos + 12, false);
      bits = view.getUint16(pos + 22, false);
    }
    pos += 8 + size;
  }
  const dataLen = view.getUint32(dataPos - 4, false);
  const samples = new Float32Array(dataLen / 2);
  for (let i = 0; i < samples.length; i++) {
    const v = view.getInt16(dataPos + i * 2, true);
    samples[i] = v / 32768;
  }
  return { samples, sampleRate, channels };
}

function encodeWav(samples, sampleRate, channels = 1) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 32767;
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  v.setUint32(0, 0x46464952, false);
  v.setUint32(4, 36 + pcm.length * 2, false);
  v.setUint32(8, 0x45564157, false);
  v.setUint32(12, 0x20746d66, false);
  v.setUint32(16, 16, false);
  v.setUint16(20, 1, false);
  v.setUint16(22, channels, false);
  v.setUint32(24, sampleRate, false);
  v.setUint32(28, byteRate, false);
  v.setUint16(32, blockAlign, false);
  v.setUint16(34, 16, false);
  v.setUint32(36, 0x61746164, false);
  v.setUint32(40, pcm.length * 2, false);
  const out = new Uint8Array(header.byteLength + pcm.length * 2);
  out.set(new Uint8Array(header), 0);
  out.set(new Uint8Array(pcm.buffer), header.byteLength);
  return out;
}

function applyAudioEffects(samples, sampleRate, effectIds, params, intensity, seed) {
  const ctx = { mediaType: 'audio', sampleRate, intensity: intensity ?? 0.5 };
  return applyEffectChain(samples, effectIds || [], ctx, prng(seed ?? 0), params || {});
}

function listEffects() {
  return ALL_EFFECTS.map((e) => ({
    id: e.id, label: e.label, hint: e.hint, category: e.category,
    mediaTypes: e.mediaTypes, slot: e.slot, cost: e.cost, motion: e.motion,
    needsChannel: e.needsChannel, realtimeSafe: e.realtimeSafe,
    stableAcrossFrames: e.stableAcrossFrames,
  }));
}

export default function openmontageMiddleware() {
  return {
    name: 'openmontage-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '/';
        if (url === '/health' && req.method === 'GET') {
          return send(res, 200, { ok: true, service: 'gleetch' });
        }
        if (url === '/effects' && req.method === 'GET') {
          return send(res, 200, {
            effects: listEffects(),
            patterns: PATTERNS.map((p) => ({ id: p.id, label: p.label, family: p.family })),
          });
        }
        if (url === '/apply' && req.method === 'POST') {
          readBody(req).then((body) => {
            try {
              decodeImage(body.image).then((bitmap) => {
                applyImageEffects(bitmap, body.effects, body.params, body.intensity, body.seed);
                encodeImagePng(bitmap).then((png) => {
                  send(res, 200, { image: bufferToB64(png), width: bitmap.width, height: bitmap.height });
                }).catch((e) => send(res, 500, { error: 'encode failed: ' + e.message }));
              }).catch((e) => send(res, 400, { error: 'image decode failed: ' + e.message }));
            } catch (e) { send(res, 500, { error: e.message }); }
          }).catch(() => send(res, 400, { error: 'invalid json body' }));
          return;
        }
        if (url === '/apply-audio' && req.method === 'POST') {
          readBody(req).then((body) => {
            try {
              const buf = b64ToBuffer(body.audio);
              const { samples, sampleRate } = decodeWav(buf);
              const out = applyAudioEffects(samples, sampleRate, body.effects, body.params, body.intensity, body.seed);
              const wav = encodeWav(out, sampleRate);
              send(res, 200, { audio: bufferToB64(wav), sampleRate, length: wav.length });
            } catch (e) { send(res, 400, { error: 'audio failed: ' + e.message }); }
          }).catch(() => send(res, 400, { error: 'invalid json body' }));
          return;
        }
        next();
      });
    },
  };
}
