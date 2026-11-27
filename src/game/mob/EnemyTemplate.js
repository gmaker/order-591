import { CREATURES, RAMP } from '../../data/creatures.js';
import { Enemy } from './Enemy.js';

/**
 * Stats for one enemy type: the creature's percentages applied to the ramp
 * at its slot in data/creatures.js.
 */
export class EnemyTemplate {
  /**
   * @param {import('../../data/creatures.js').CreatureDef} def
   * @param {number} slot position in the creature list
   */
  constructor(def, slot) {
    const ramp = (/** @type {{ base: number, mul: number, add: number }} */ c) => {
      let v = c.base;
      for (let i = 0; i < slot; i++) v = v * c.mul + c.add;
      return v;
    };
    this.name = def.name;
    this.hp = Math.max(1, Math.round((def.hp * ramp(RAMP.hp)) / 100));
    this.atk = Math.max(1, Math.round((def.atk * ramp(RAMP.atk)) / 100));
    this.def = Math.max(1, Math.round((def.def * ramp(RAMP.def)) / 100));
    this.spd = def.spd;
    this.kind = def.kind;
    this.color = def.color;
    this.xp = Math.round(ramp(RAMP.xp));
  }

  /** @param {number} x @param {number} y */
  spawn(x, y) { return new Enemy(x, y, this); }
}

/** All enemy types, weakest first. */
export const ENEMY_TEMPLATES = CREATURES.map((def, slot) => new EnemyTemplate(def, slot));

/**
 * Picks enemies for a floor: a window over the template list that slides
 * deeper with depth and widens slightly as it goes.
 */
export class EnemySpawner {
  /** @type {import('../../core/Rng.js').Rng} */ #rng;

  /** @param {import('../../core/Rng.js').Rng} rng */
  constructor(rng) {
    this.#rng = rng;
  }

  /**
   * @param {number} depth 1-based floor number
   * @param {number} x @param {number} y
   */
  spawn(depth, x, y) {
    const n = ENEMY_TEMPLATES.length;
    const range = ((n / 8) | 0) + 1 + ((depth / 7) | 0);
    const offset = (((n - range) * (depth - 1)) / 15) | 0;
    const slot = Math.min(n - 1, offset + this.#rng.nextInt(range));
    return ENEMY_TEMPLATES[slot].spawn(x, y);
  }
}
