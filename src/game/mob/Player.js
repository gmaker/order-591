import { CLASSES, GENDERS, RACES } from '../../data/characters.js';
import { PACK_SIZE, Resource, Slot } from '../../data/items.js';
import { globalRng } from '../../core/Rng.js';
import { G } from '../../gfx/Atlas.js';
import { Equipment } from '../item/Equipment.js';
import { Key } from '../item/Key.js';
import { Faction } from './Faction.js';
import { Mob } from './Mob.js';
import { t } from '../../i18n.js';

/** Ticks between one point of mana regeneration. */
const MANA_INTERVAL = 4;

/**
 * The one holding the oath. Stats are rolled 3d6, race and class come from
 * data/characters.js, gear sits in named slots and the pack is a short
 * newest-first list that sells its oldest item when full.
 */
export class Player extends Mob {
  /** @type {import('../../data/characters.js').RaceDef} */
  race = RACES[0];
  /** @type {import('../../data/characters.js').ClassDef} */
  job = CLASSES[0];
  gender = GENDERS[0];
  str = 10;
  dex = 10;
  iq = 10;
  xp = 0;
  xpNext = 120;
  xpLevel = 1;
  gold = 0;
  arrows = 0;
  mana = 10;
  manaMax = 10;
  #manaTick = 0;
  /** Newest first. @type {import('../item/Item.js').Item[]} */
  inventory = [];
  /** @type {Record<string, Equipment|null>} keyed by Slot */
  equipment = Object.fromEntries(Object.values(Slot).map(s => [s, null]));

  constructor() {
    super();
    this.reroll();
    this.glyph = G.PLAYER;
    this.color = 12;
    this.faction = Faction.PLAYER;
    this.name = '';
  }

  get isPlayer() { return true; }

  reroll() {
    const rng = globalRng;
    this.str = rng.roll(6, 3);
    this.dex = rng.roll(6, 3);
    this.iq = rng.roll(6, 3);
    this.hpMax = this.hp = rng.roll(6, 3) + 10;
  }

  /**
   * Bake race and class into the base stats. Called once when the run starts.
   * @param {import('../../data/characters.js').RaceDef} race
   * @param {import('../../data/characters.js').ClassDef} job
   */
  applyOrigin(race, job) {
    this.race = race;
    this.job = job;
    this.hpMax += race.hp;
    this.hp = this.hpMax;
    this.str += race.str;
    this.dex += race.dex;
    this.iq += race.int;
    this.healInterval = race.healInterval;
    this.color = race.color;
    this.manaMax = job.manaMax;
    this.mana = this.manaMax;
    this.arrows = job.startArrows;
  }

  getName() { return t('you'); }

  tick() {
    super.tick();
    if (++this.#manaTick >= MANA_INTERVAL) {
      this.#manaTick = 0;
      if (this.mana < this.manaMax) this.mana++;
    }
  }

  // ── Progression ──────────────────────────────────────────────────────────

  /** @param {Mob} victim */
  kill(victim) {
    let xp = victim.xpReward;
    const r = ((xp / 2) | 0) + 1;
    xp += this.rng.nextInt(r) - this.rng.nextInt(r);
    xp = ((xp * (100 + this.#sumEquipment(e => e.xpBonus))) / 100) | 0;
    this.addXp(xp);
  }

  /** XP caps at the next-level threshold until an altar is used. */
  addXp(amount) {
    this.xp = Math.min(this.xpNext, this.xp + amount);
  }

  get canLevelUp() { return this.xp >= this.xpNext; }

  /** @returns {string} summary of what changed */
  levelUp() {
    const rng = this.rng;
    this.xp = 0;
    this.xpNext = ((this.xpNext * 120) / 100 | 0) + 60;
    this.xpLevel++;
    const hpAdd = rng.roll(6, 3);
    this.hpMax += hpAdd;
    this.hp += hpAdd;
    const manaAdd = 2;
    this.manaMax += manaAdd;
    this.mana += manaAdd;

    let msg = `HP+${hpAdd}`;
    if (rng.nextInt(3) >= 2) { this.str++; msg += ', str+1'; }
    if (rng.nextInt(3) >= 2) { this.dex++; msg += ', dex+1'; }
    if (rng.nextInt(3) >= 2) { this.iq++; msg += ', int+1'; }
    return msg;
  }

  // ── Pack and gear ────────────────────────────────────────────────────────

  /**
   * Put an item in the pack (newest first). When the pack is full the oldest
   * item is sold and returned so the caller can report it.
   * @param {import('../item/Item.js').Item} item
   * @returns {import('../item/Item.js').Item|null} the item sold to make room
   */
  addItem(item) {
    this.inventory.unshift(item);
    if (this.inventory.length <= PACK_SIZE) return null;
    const sold = /** @type {import('../item/Item.js').Item} */ (this.inventory.pop());
    this.gold += sold.sellValue;
    return sold;
  }

  /**
   * Equip from the pack; whatever was in the slot takes the item's place.
   * @param {Equipment} item must be in the inventory
   * @returns {boolean}
   */
  equip(item) {
    const index = this.inventory.indexOf(item);
    if (index < 0 || !this.canUse(item)) return false;
    const previous = this.equipment[item.slot];
    this.equipment[item.slot] = item;
    if (previous !== null) this.inventory[index] = previous;
    else this.inventory.splice(index, 1);
    return true;
  }

  /**
   * Take gear off into the pack.
   * @param {string} slot
   * @returns {Equipment|null} what was removed
   */
  unequip(slot) {
    const item = this.equipment[slot];
    if (item === null) return null;
    this.equipment[slot] = null;
    this.addItem(item);
    return item;
  }

  /**
   * @param {number} lockColor
   * @returns {Key|null} a matching key from the pack
   */
  getKey(lockColor) {
    for (const item of this.inventory) {
      if (item instanceof Key && item.keyColor === lockColor) return item;
    }
    return null;
  }

  /** @param {(e: Equipment) => number} pick */
  #sumEquipment(pick) {
    let total = 0;
    for (const e of Object.values(this.equipment)) if (e !== null) total += pick(e);
    return total;
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  getStr() { return this.str + this.#sumEquipment(e => e.strBonus); }
  getInt() { return this.iq + this.#sumEquipment(e => e.intBonus); }
  getDex() { return this.dex + this.#sumEquipment(e => e.dexBonus); }

  getSpeed() {
    const value = 100 + this.getDex() - 11 + this.#sumEquipment(e => e.speedBonus);
    return Math.max(10, (value * this.race.speed) | 0);
  }

  /** @returns {Equipment|null} */
  get weapon() { return this.equipment[Slot.WEAPON]; }

  /** @returns {Equipment|null} the equipped bow or staff */
  get rangedWeapon() {
    const w = this.weapon;
    return w !== null && w.isRanged ? w : null;
  }

  getMelee() {
    const w = this.weapon;
    const value = this.getStr() + (w !== null && w.isMelee ? w.power : 0);
    return Math.max(1, (value * this.job.melee) | 0);
  }

  /** Ranged attack value (RNG on the HUD). */
  getAtk() {
    const w = this.rangedWeapon;
    const value = this.getInt() + (w !== null ? w.power : 0);
    return Math.max(1, (value * this.job.ranged) | 0);
  }

  /**
   * Whether the class can wield an item at all (bows and staves are class-bound).
   * @param {import('../item/Item.js').Item} item
   */
  canUse(item) {
    if (!(item instanceof Equipment)) return false;
    return item.weaponKind === null || this.job.weapons.includes(item.weaponKind);
  }

  getDef() {
    return this.getDex() + this.#sumEquipment(e => (e.isArmor ? e.power : 0));
  }

  /**
   * Whether a shot can be fired right now, and why not.
   * @returns {{ ok: boolean, reason?: string }}
   */
  canShoot() {
    const w = this.rangedWeapon;
    if (w === null) return { ok: false, reason: 'You have nothing to shoot with' };
    if (w.resource === Resource.ARROWS && this.arrows < w.shotCost) return { ok: false, reason: 'You are out of arrows' };
    if (w.resource === Resource.MANA && this.mana < w.shotCost) return { ok: false, reason: 'Not enough mana' };
    return { ok: true };
  }

  /** Spend the shot's resource; call after canShoot(). */
  spendShot() {
    const w = this.rangedWeapon;
    if (w === null) return;
    if (w.resource === Resource.ARROWS) this.arrows -= w.shotCost;
    else if (w.resource === Resource.MANA) this.mana -= w.shotCost;
  }

  /** Stat as a §-coloured string: green when boosted, red when lowered. */
  #statString(base, value) {
    if (value > base) return `§a${value}`;
    if (value < base) return `§4${value}`;
    return `${value}`;
  }

  getStrString() { return this.#statString(this.str, this.getStr()); }
  getIntString() { return this.#statString(this.iq, this.getInt()); }
  getDexString() { return this.#statString(this.dex, this.getDex()); }

  get carriedWeight() {
    let total = 0;
    for (const item of this.inventory) total += item.weight;
    return total;
  }

  isOverBurdened() { return this.carriedWeight > this.getStr() * 10; }
}
