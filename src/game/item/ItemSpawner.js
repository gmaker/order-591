import {
  AFFIX_REQUIRED, AFFIXES, CATEGORIES, CATEGORY_WEIGHTS, CONSUMABLES, SPELLS,
} from '../../data/items.js';
import { G } from '../../gfx/Atlas.js';
import { Ammo } from './Ammo.js';
import { Equipment } from './Equipment.js';
import { Consumable } from './Food.js';
import { Key } from './Key.js';
import { MoneyBag } from './MoneyBag.js';

const CATEGORY_BY_ID = new Map(CATEGORIES.map(c => [c.id, c]));
const TOTAL_WEIGHT = CATEGORY_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

/**
 * Random item generation driven by data/items.js. `maxValue` is the floor's
 * budget (Level.maxValue): tiers and affixes are only rolled when the
 * budget affords them, so loot scales with depth without per-floor tables.
 */
export class ItemSpawner {
  /** @type {import('../../core/Rng.js').Rng} */ #rng;

  /** @param {import('../../core/Rng.js').Rng} rng */
  constructor(rng) {
    this.#rng = rng;
  }

  /**
   * @param {number} maxValue
   * @returns {import('./Item.js').Item | null} null means "nothing dropped"
   */
  spawnItem(maxValue) {
    const rng = this.#rng;
    if (rng.nextInt(4) === 0) {
      return new MoneyBag((((rng.nextInt((maxValue / 2) | 0) + ((maxValue / 2) | 0)) / 4) | 0) + 1);
    }
    if (rng.nextInt(4) === 0) return new Ammo(rng.nextInt(8) + 1);
    if (rng.nextInt(10) === 0) return new Key(rng.nextInt(3));
    if (rng.nextInt(8) === 0) return this.#spawnConsumable(maxValue);
    if (rng.nextInt(5) < 2) return this.spawnEquipment(maxValue);
    return null;
  }

  /**
   * A specific base item by tier name (starting gear), at its plain quality.
   * @param {string} tierName
   */
  spawnNamed(tierName) {
    for (const category of CATEGORIES) {
      const tier = category.tiers.find(t => t.name === tierName);
      if (tier) {
        const e = this.#fromTier(category, tier);
        this.#finish(e);
        return e;
      }
    }
    throw new Error(`Unknown item "${tierName}"`);
  }

  /** @param {number} maxValue */
  spawnEquipment(maxValue) {
    const category = this.#pickCategory();
    const tier = this.#pickTier(category, maxValue);
    const e = this.#fromTier(category, tier);
    const forced = AFFIX_REQUIRED.has(category.id);
    this.#addAffix(e, forced ? Number.MAX_SAFE_INTEGER : maxValue, forced);
    this.#finish(e);
    return e;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  #pickCategory() {
    let roll = this.#rng.nextInt(TOTAL_WEIGHT);
    for (const [id, weight] of CATEGORY_WEIGHTS) {
      roll -= weight;
      if (roll < 0) return /** @type {import('../../data/items.js').ItemCategory} */ (CATEGORY_BY_ID.get(id));
    }
    return CATEGORIES[0];
  }

  /**
   * Best to worst: each better tier needs the budget and a 1-in-4 roll; the
   * last tier is the fallback.
   * @param {import('../../data/items.js').ItemCategory} category
   * @param {number} maxValue
   */
  #pickTier(category, maxValue) {
    const tiers = category.tiers;
    for (let i = 0; i < tiers.length - 1; i++) {
      if (this.#rng.nextInt(4) === 0 && maxValue > tiers[i].value) return tiers[i];
    }
    return tiers[tiers.length - 1];
  }

  /**
   * @param {import('../../data/items.js').ItemCategory} category
   * @param {import('../../data/items.js').ItemTier} tier
   */
  #fromTier(category, tier) {
    const e = new Equipment();
    e.slot = category.slot;
    e.categoryId = category.id;
    e.stat = category.stat;
    e.weaponKind = category.weaponKind ?? null;
    e.resource = category.resource ?? null;
    e.shotCost = tier.cost ?? 0;
    e.spell = tier.spell !== undefined ? SPELLS[tier.spell] : null;
    e.glyph = G[category.glyph] ?? G.ITEM_FALLBACK ?? G.MELEE;
    e.name = tier.name;
    e.baseName = tier.name;
    e.power = tier.power;
    e.value = tier.value;
    e.weight = tier.weight;
    if (tier.color !== undefined) e.color = tier.color;
    return e;
  }

  /**
   * One optional affix, tried from rarest to most common.
   * @param {Equipment} e @param {number} maxValue @param {boolean} forced always apply one
   */
  #addAffix(e, maxValue, forced) {
    const rng = this.#rng;
    for (let attempt = 0; attempt < (forced ? 50 : 1); attempt++) {
      for (const affix of AFFIXES) {
        if (rng.nextInt((affix.odds / 4) | 0) !== 0) continue;
        const newValue = (((e.value + affix.cost) * affix.cost) / 100) | 0;
        if (newValue > maxValue) continue;
        e.value = newValue;
        this.#applyAffix(e, affix);
        return;
      }
    }
  }

  /**
   * @param {Equipment} e
   * @param {import('../../data/items.js').Affix} affix
   */
  #applyAffix(e, affix) {
    const m = affix.mods;
    e.name = `${affix.name} ${e.name}`;
    e.affixName = affix.name;
    e.addDescription(affix.desc);
    if (affix.color !== undefined) e.color = affix.color;
    if (m.str) e.strBonus += m.str;
    if (m.dex) e.dexBonus += m.dex;
    if (m.int) e.intBonus += m.int;
    if (m.hp) e.hpBonus += m.hp;
    if (m.xp) e.xpBonus += m.xp;
    if (m.speed) e.speedBonus += m.speed;
    if (m.powerAdd) e.power += m.powerAdd;
    if (m.powerMul) e.power = (e.power * m.powerMul) | 0;
    if (m.weightMul) e.weight = (e.weight * m.weightMul) | 0;
    if (m.priceMul) e.priceFactor = (e.priceFactor * m.priceMul) | 0;
  }

  /** Final jitter on value, weight and power; magic items get a blue name. */
  #finish(e) {
    const rng = this.#rng;
    e.value *= 5;
    let r = ((e.value / 4) | 0) + 1;
    e.value += rng.nextInt(r) - rng.nextInt(r);
    r = ((e.weight / 2) | 0) + 1;
    e.weight += rng.nextInt(r) - rng.nextInt(r);
    if (e.power > 0) {
      r = ((e.power / 2) | 0) + 1;
      e.power += rng.nextInt(r) - rng.nextInt(r);
    }
    if (e.descriptions.length > 0) e.textColor = 3;
    e.descriptions.unshift({ key: `${e.stat} +{power}`, params: { power: e.power } });
  }

  /** @param {number} maxValue */
  #spawnConsumable(maxValue) {
    let def = CONSUMABLES[CONSUMABLES.length - 1];
    for (let i = 0; i < CONSUMABLES.length - 1; i++) {
      if (this.#rng.nextInt(3) === 0 && maxValue >= CONSUMABLES[i].minBudget) { def = CONSUMABLES[i]; break; }
    }
    const item = new Consumable(def);
    item.value *= 5;
    item.addDescription('Use to heal {n}', { n: item.power });
    return item;
  }
}
