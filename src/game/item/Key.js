import { KEYS } from '../../data/items.js';
import { G } from '../../gfx/Atlas.js';
import { Item } from './Item.js';

/** Lock kinds, indexing both keys and locked doors. */
export const LockColor = Object.freeze({ BRONZE: 0, SILVER: 1, GOLD: 2 });

/** @param {number} lock */
export function lockName(lock) { return KEYS[lock]?.doorName ?? '?'; }

/** @param {number} lock @returns {number} palette index */
export function lockColorIndex(lock) { return KEYS[lock]?.color ?? 15; }

/** Single-use key that opens one locked door of its metal. */
export class Key extends Item {
  /** @param {number} keyColor one of LockColor */
  constructor(keyColor) {
    super();
    const def = KEYS[keyColor] ?? KEYS[0];
    this.keyColor = keyColor;
    this.color = def.color;
    this.name = def.name;
    this.addDescription(`Opens ${def.doorName} doors`);
    this.weight = 1;
    this.value = 5;
    this.glyph = G.KEY;
  }
}
