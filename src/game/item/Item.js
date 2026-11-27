import { G } from '../../gfx/Atlas.js';
import { t } from '../../i18n.js';

/** Anything that can lie on the floor or sit in an inventory. */
export class Item {
  glyph = G.SPACE;
  color = 15;
  /** Base value; buy/sell prices derive from it. */
  value = 0;
  /** Tenths of a kilogram. */
  weight = 0;
  /** Lines shown in the tooltip, as text keys with their parameters. @type {{ key: string, params: Record<string, string|number> }[]} */
  descriptions = [];
  /** English name, which is also the text key; show `label`. */
  name = 'item';
  /** Colour of the name in lists; magic items get a tint. */
  textColor = 7;
  power = 0;

  get sellValue() { return (this.value / 10) | 0; }
  get buyValue() { return this.value; }
  /** Whether use() can do something (potions, food). */
  get isUsable() { return false; }

  /** Name in the current language. */
  get label() { return t(this.name); }

  /** Description lines in the current language. */
  get lines() { return this.descriptions.map(d => t(d.key, d.params)); }

  /** @param {string} key @param {Record<string, string|number>} [params] */
  addDescription(key, params = {}) { this.descriptions.push({ key, params }); }

  /**
   * Consume the item. Returns true if it was used up.
   * @param {import('../mob/Player.js').Player} player
   */
  use(player) { return false; }
}
