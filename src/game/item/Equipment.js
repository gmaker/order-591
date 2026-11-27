import { Slot, WeaponKind } from '../../data/items.js';
import { t } from '../../i18n.js';
import { Item } from './Item.js';

/** Wearable or wieldable item with stat bonuses, built by ItemSpawner from data. */
export class Equipment extends Item {
  /** @type {string} one of Slot */
  slot = Slot.WEAPON;
  /** Tier name without the affix, a text key. */
  baseName = '';
  /** Affix name, a text key, or null. @type {string|null} */
  affixName = null;
  /** Category id from data/items.js (melee, bow, helmet, ...). */
  categoryId = '';
  /** Label of the main stat: MLE, RNG or DEF. */
  stat = 'DEF';
  /** @type {string|null} one of WeaponKind for weapons */
  weaponKind = null;
  /** @type {string|null} resource a ranged weapon spends per shot */
  resource = null;
  shotCost = 0;
  /** @type {import('../../data/items.js').SpellDef|null} what a staff casts */
  spell = null;
  /** Percent applied to both buy and sell price (rusty gear sells for less). */
  priceFactor = 100;

  strBonus = 0;
  dexBonus = 0;
  intBonus = 0;
  hpBonus = 0;
  xpBonus = 0;
  speedBonus = 0;

  get label() {
    if (this.affixName === null) return t(this.baseName || this.name);
    return t('{affix} {tier}', { affix: t(this.affixName), tier: t(this.baseName) });
  }

  get sellValue() { return ((super.sellValue * this.priceFactor) / 100) | 0; }
  get buyValue() { return ((super.buyValue * this.priceFactor) / 100) | 0; }

  get isWeapon() { return this.slot === Slot.WEAPON; }
  get isMelee() { return this.weaponKind === WeaponKind.MELEE; }
  get isRanged() { return this.weaponKind === WeaponKind.BOW || this.weaponKind === WeaponKind.STAFF; }
  /** Counts toward defence: anything worn, plus the off hand. */
  get isArmor() { return !this.isWeapon; }
}
