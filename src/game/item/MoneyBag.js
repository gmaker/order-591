import { CURRENCY } from '../../data/items.js';
import { G } from '../../gfx/Atlas.js';
import { tn } from '../../i18n.js';
import { Item } from './Item.js';

/** Picked up automatically when stepped on. */
export class MoneyBag extends Item {
  /** @param {number} value */
  constructor(value) {
    super();
    this.value = value;
    this.color = 14;
    this.glyph = G.MONEY;
    this.name = `${value} ${CURRENCY}`;
  }

  get label() { return tn(this.value, 'gold'); }
}
