import { G } from '../../gfx/Atlas.js';
import { Item } from './Item.js';

/** Heals on use. Some races cannot eat. */
export class Consumable extends Item {
  /** @param {import('../../data/items.js').Consumable} def */
  constructor(def) {
    super();
    this.power = def.heal;
    this.color = def.color;
    this.glyph = G[def.glyph] ?? G.FOOD;
    this.name = def.name;
    this.weight = def.weight;
    this.value = def.value;
  }

  get isUsable() { return true; }

  /** @param {import('../mob/Player.js').Player} player */
  use(player) {
    if (!player.race.canEat || player.hp >= player.hpMax) return false;
    player.hp = Math.min(player.hpMax, player.hp + this.power);
    return true;
  }
}
