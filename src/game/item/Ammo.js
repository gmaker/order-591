import { ARROWS_NAME } from '../../data/items.js';
import { G } from '../../gfx/Atlas.js';
import { tn } from '../../i18n.js';
import { Item } from './Item.js';

/** A bundle of arrows; picked up automatically when stepped on. */
export class Ammo extends Item {
  /** @param {number} value arrows */
  constructor(value) {
    super();
    this.value = value;
    this.color = 14;
    this.glyph = G.AMMO;
    this.name = `${value} ${ARROWS_NAME}`;
  }

  get label() { return tn(this.value, 'arrows'); }
}
