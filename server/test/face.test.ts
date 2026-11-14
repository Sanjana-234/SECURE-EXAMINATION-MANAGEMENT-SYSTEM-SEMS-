import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectFaces } from '../public/facedetect.js';

// Fixtures are 320x240 grey frames derived from the public-domain NASA "astronaut" image (one face, two faces) and
// the public-domain "coffee" image (no face). They were checked against OpenCV's own detector.
const cascade = JSON.parse(readFileSync(new URL('../public/face-cascade.json', import.meta.url), 'utf8'));
const frame = (n: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${n}.gray`, import.meta.url)));
const opts = { minNeighbors: 4, minSize: 40 };

test('face model: OpenCV frontal-face cascade is loaded intact', () => {
  assert.equal(cascade.stages.length, 20); assert.equal(cascade.w, 20); assert.equal(cascade.h, 20);
  assert.ok(cascade.feats.length > 2000);
});

test('face detector: one face, two faces, and no face are told apart', () => {
  const one = detectFaces(frame('face90'), 320, 240, cascade, opts);
  assert.equal(one.length, 1); assert.ok(one[0].w >= 80 && one[0].w <= 105, 'box size ' + one[0].w);
  assert.ok(Math.abs(one[0].x + one[0].w / 2 - 160) < 25 && Math.abs(one[0].y + one[0].h / 2 - 120) < 25, 'face is near the frame centre');
  assert.equal(detectFaces(frame('two_faces'), 320, 240, cascade, opts).length, 2);
  assert.equal(detectFaces(frame('no_coffee'), 320, 240, cascade, opts).length, 0);
});

test('face detector: blank, black and noise frames contain no face', () => {
  assert.equal(detectFaces(new Uint8Array(320 * 240), 320, 240, cascade, opts).length, 0);
  assert.equal(detectFaces(new Uint8Array(320 * 240).fill(120), 320, 240, cascade, opts).length, 0);
  let seed = 12345; const noise = new Uint8Array(320 * 240).map(() => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16) & 255);
  assert.equal(detectFaces(noise, 320, 240, cascade, opts).length, 0);
});
