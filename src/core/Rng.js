/**
 * Seeded 32-bit PRNG (mulberry32). Every source of randomness in the game
 * goes through an Rng so a run can be reproduced from its seed.
 */
export class Rng {
  /** @type {number} */ #state;

  /** @param {number} [seed] 32-bit seed; random when omitted */
  constructor(seed = (Math.random() * 0x100000000) >>> 0) {
    this.#state = seed >>> 0;
  }

  /** @returns {number} next unsigned 32-bit value */
  next() {
    let t = (this.#state = (this.#state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** @returns {number} float in [0, 1) */
  nextFloat() { return this.next() / 0x100000000; }

  /**
   * Integer in [0, n). Returns 0 for n <= 0 (where Java's Random would throw).
   * @param {number} n
   */
  nextInt(n) {
    if (n <= 0) return 0;
    return Math.floor(this.nextFloat() * n);
  }

  nextBool() { return (this.next() & 1) === 1; }

  /**
   * Sum of `count` dice with faces 1..sides.
   * @param {number} sides @param {number} count
   */
  roll(sides, count) {
    let sum = 0;
    for (let i = 0; i < count; i++) sum += this.nextInt(sides);
    return sum + count;
  }

  /** Independent generator derived from this one's stream. */
  fork() { return new Rng(this.next()); }

  /**
   * Mix several integers into one 32-bit seed (for per-floor generators).
   * @param {...number} parts
   */
  static hash(...parts) {
    let h = 0x811c9dc5;
    for (const p of parts) {
      h ^= p >>> 0;
      h = Math.imul(h, 0x01000193);
      h ^= h >>> 13;
    }
    return h >>> 0;
  }

  /**
   * Seed from a string (for daily / shared seeds).
   * @param {string} text
   */
  static seedFromString(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
}

/** Generator for things outside a run's determinism (character rolls, UI). */
export const globalRng = new Rng();
