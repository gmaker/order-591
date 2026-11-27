import { WeaponKind } from './items.js';

/**
 * Races and classes for character creation. Everything the player screen
 * and the Player's stat formulas need about them is here.
 */

/**
 * @typedef {object} RaceDef
 * @property {string} id
 * @property {string} name
 * @property {number} hp flat bonus to starting hp
 * @property {number} str @property {number} dex @property {number} int
 * @property {number} speed multiplier
 * @property {number} healInterval ticks per point of natural regeneration
 * @property {boolean} canEat
 * @property {number} color body tint, palette index
 * @property {number} height body scale
 * @property {[string, string]} desc two lines shown on the creation screen
 */

/** @type {RaceDef[]} */
export const RACES = [
  {
    id: 'human', name: 'Human', hp: 0, str: 0, dex: 0, int: 0, speed: 1, healInterval: 5, canEat: true,
    color: 12, height: 1,
    desc: ['Humans have no special gifts.', 'They can use all equipment.'],
  },
  {
    id: 'elf', name: 'Elf', hp: -4, str: -1, dex: 2, int: 2, speed: 1.1, healInterval: 5, canEat: true,
    color: 10, height: 1.08,
    desc: ['Elves are quick and clever,', 'but fragile.'],
  },
  {
    id: 'dwarf', name: 'Dwarf', hp: 6, str: 3, dex: -1, int: -1, speed: 0.85, healInterval: 3, canEat: true,
    color: 6, height: 0.82,
    desc: ['Dwarves are tough and heal fast,', 'but slow on their feet.'],
  },
  {
    id: 'revenant', name: 'Revenant', hp: -6, str: 2, dex: 2, int: 0, speed: 1, healInterval: 1, canEat: false,
    color: 11, height: 1,
    desc: ['The dead mend quickly, but', 'cannot eat or drink.'],
  },
];

/**
 * @typedef {object} ClassDef
 * @property {string} id
 * @property {string} name
 * @property {number} melee multiplier on melee attack
 * @property {number} ranged multiplier on shots and spells
 * @property {string[]} weapons WeaponKind values the class can wield
 * @property {string} startWeapon tier name from items.js
 * @property {number} startArrows
 * @property {number} manaMax
 * @property {[string, string]} desc
 */

/** @type {ClassDef[]} */
export const CLASSES = [
  {
    id: 'warrior', name: 'Warrior', melee: 2, ranged: 0.5, weapons: [WeaponKind.MELEE, WeaponKind.BOW],
    startWeapon: 'Sword', startArrows: 0, manaMax: 10,
    desc: ['Warriors hit hard up close and', 'can draw a bow, poorly. No staves.'],
  },
  {
    id: 'ranger', name: 'Ranger', melee: 0.6, ranged: 2, weapons: [WeaponKind.MELEE, WeaponKind.BOW],
    startWeapon: 'Shortbow', startArrows: 25, manaMax: 10,
    desc: ['Rangers shoot well and fight', 'poorly. Arrows run out. No staves.'],
  },
  {
    id: 'mage', name: 'Mage', melee: 0.6, ranged: 2, weapons: [WeaponKind.MELEE, WeaponKind.STAFF],
    startWeapon: 'Ember wand', startArrows: 0, manaMax: 30,
    desc: ['Mages cast through a staff and', 'fight poorly. Mana returns. No bows.'],
  },
];

export const GENDERS = ['Female', 'Male'];
