import { Rng } from './Rng.js';

/**
 * Classic 2D Perlin gradient noise with a seeded permutation table, plus a
 * two-octave sum for soft blobs. Used for where grass grows and how tall.
 */
export class Noise {
  /** @type {Uint8Array} */ #perm = new Uint8Array(512);

  /** @param {number} seed */
  constructor(seed) {
    const rng = new Rng(seed);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.#perm[i] = p[i & 255];
  }

  /**
   * Raw Perlin value in -1..1.
   * @param {number} x @param {number} y
   */
  perlin(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const p = this.#perm;
    const aa = p[p[xi] + yi];
    const ab = p[p[xi] + yi + 1];
    const ba = p[p[xi + 1] + yi];
    const bb = p[p[xi + 1] + yi + 1];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  }

  /**
   * Two octaves, mapped to 0..1.
   * @param {number} x @param {number} y
   */
  at(x, y) {
    const n = this.perlin(x, y) + 0.5 * this.perlin(x * 2.1 + 17.3, y * 2.1 + 9.1);
    return Math.min(1, Math.max(0, n / 1.1 * 0.5 + 0.5));
  }
}

/** @param {number} t */
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

/** @param {number} a @param {number} b @param {number} t */
function lerp(a, b, t) { return a + (b - a) * t; }

/** Eight gradient directions picked by the hash. */
function grad(hash, x, y) {
  switch (hash & 7) {
    case 0: return x + y;
    case 1: return -x + y;
    case 2: return x - y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
}
