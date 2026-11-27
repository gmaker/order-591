/**
 * Item content. Everything the item generator knows about equipment lives
 * here: slots, base items in tiers (best first), affixes, consumables, keys.
 * A tier is only rolled when the floor's loot budget (depth² + 8·depth,
 * so 9 on floor 1 and 384 on floor 16) exceeds its value: chain and the
 * power-10 weapons from floor 4, plate from floor 8, mithril from floor 12.
 */

/** Where a piece of equipment goes. */
export const Slot = Object.freeze({
  WEAPON: 'weapon',
  OFFHAND: 'offhand',
  HEAD: 'head',
  TORSO: 'torso',
  LEGS: 'legs',
  RING: 'ring',
  AMULET: 'amulet',
});

/** Slot order for the equipment panel. */
export const SLOT_ORDER = [Slot.HEAD, Slot.AMULET, Slot.TORSO, Slot.WEAPON, Slot.OFFHAND, Slot.RING, Slot.LEGS];

/** @type {Record<string, string>} */
export const SLOT_NAMES = {
  [Slot.WEAPON]: 'Weapon',
  [Slot.OFFHAND]: 'Off hand',
  [Slot.HEAD]: 'Head',
  [Slot.TORSO]: 'Body',
  [Slot.LEGS]: 'Legs',
  [Slot.RING]: 'Ring',
  [Slot.AMULET]: 'Amulet',
};

export const WeaponKind = Object.freeze({ MELEE: 'melee', BOW: 'bow', STAFF: 'staff' });

/** What a ranged weapon spends per shot. */
export const Resource = Object.freeze({ ARROWS: 'arrows', MANA: 'mana' });

/**
 * @typedef {object} ItemTier
 * @property {string} name
 * @property {number} power
 * @property {number} value budget needed and base price
 * @property {number} weight tenths of a kg
 * @property {number} [color] palette index; categories without one keep the default
 * @property {number} [cost] resource spent per shot (ranged weapons)
 * @property {string} [spell] id from SPELLS (staves)
 */

/**
 * @typedef {object} ItemCategory
 * @property {string} id
 * @property {string} slot one of Slot
 * @property {string} glyph sprite name in Sprites.js
 * @property {string} stat label of the main stat: MLE, RNG or DEF
 * @property {string} [weaponKind]
 * @property {string} [resource]
 * @property {boolean} [prefixTier] put the tier name before the category name ("Leather helmet")
 * @property {ItemTier[]} tiers best first
 */

/** @type {ItemCategory[]} */
export const CATEGORIES = [
  {
    id: 'melee', slot: Slot.WEAPON, glyph: 'MELEE', stat: 'MLE', weaponKind: WeaponKind.MELEE,
    tiers: [
      { name: 'Runeblade', power: 25, value: 200, weight: 50, color: 11 },
      { name: 'Greatsword', power: 15, value: 90, weight: 40, color: 15 },
      { name: 'Sword', power: 10, value: 35, weight: 30, color: 7 },
      { name: 'Dagger', power: 5, value: 10, weight: 20, color: 8 },
    ],
  },
  {
    id: 'bow', slot: Slot.WEAPON, glyph: 'BOW', stat: 'RNG', weaponKind: WeaponKind.BOW, resource: Resource.ARROWS,
    tiers: [
      { name: 'Warbow', power: 25, value: 200, weight: 40, color: 11, cost: 1 },
      { name: 'Longbow', power: 15, value: 90, weight: 30, color: 15, cost: 1 },
      { name: 'Hunting bow', power: 10, value: 35, weight: 20, color: 6, cost: 1 },
      { name: 'Shortbow', power: 5, value: 10, weight: 15, color: 4, cost: 1 },
    ],
  },
  {
    id: 'staff', slot: Slot.WEAPON, glyph: 'STAFF', stat: 'RNG', weaponKind: WeaponKind.STAFF, resource: Resource.MANA,
    tiers: [
      { name: 'Archstaff', power: 25, value: 200, weight: 40, color: 13, cost: 8, spell: 'storm' },
      { name: 'Staff of Embers', power: 15, value: 90, weight: 30, color: 12, cost: 5, spell: 'fire' },
      { name: 'Frost staff', power: 10, value: 35, weight: 25, color: 11, cost: 3, spell: 'ice' },
      { name: 'Storm rod', power: 10, value: 35, weight: 20, color: 9, cost: 4, spell: 'chain' },
      { name: 'Ember staff', power: 10, value: 35, weight: 25, color: 4, cost: 3, spell: 'fire' },
      { name: 'Ember wand', power: 5, value: 10, weight: 10, color: 6, cost: 2, spell: 'fire' },
      { name: 'Wand', power: 6, value: 10, weight: 10, color: 5, cost: 2, spell: 'bolt' },
    ],
  },
  {
    id: 'shield', slot: Slot.OFFHAND, glyph: 'SHIELD', stat: 'DEF',
    tiers: [
      { name: 'Mithril shield', power: 25, value: 200, weight: 50, color: 14 },
      { name: 'Tower shield', power: 15, value: 90, weight: 45, color: 15 },
      { name: 'Kite shield', power: 10, value: 35, weight: 35, color: 8 },
      { name: 'Buckler', power: 5, value: 10, weight: 20, color: 4 },
    ],
  },
  { id: 'helmet', slot: Slot.HEAD, glyph: 'HELMET', stat: 'DEF', prefixTier: true, tiers: armorTiers('helmet') },
  { id: 'armor', slot: Slot.TORSO, glyph: 'ARMOR', stat: 'DEF', prefixTier: true, tiers: armorTiers('armor') },
  { id: 'greaves', slot: Slot.LEGS, glyph: 'PANTS', stat: 'DEF', prefixTier: true, tiers: armorTiers('greaves') },
  {
    id: 'ring', slot: Slot.RING, glyph: 'RING', stat: 'DEF',
    tiers: [
      { name: 'Gold ring', power: 0, value: 160, weight: 1, color: 14 },
      { name: 'Silver ring', power: 0, value: 50, weight: 1, color: 15 },
      { name: 'Copper ring', power: 0, value: 20, weight: 1, color: 6 },
    ],
  },
  {
    id: 'amulet', slot: Slot.AMULET, glyph: 'AMULET', stat: 'DEF',
    tiers: [
      { name: 'Moon amulet', power: 0, value: 160, weight: 2, color: 11 },
      { name: 'Bone amulet', power: 0, value: 50, weight: 2, color: 15 },
      { name: 'Wooden charm', power: 0, value: 20, weight: 2, color: 6 },
    ],
  },
];

/**
 * What a staff throws. `projectile` picks the model and particles in the
 * view; the numbers below are gameplay: chain hops, splash fraction, freeze
 * chance and the turns a frozen target loses.
 * @typedef {object} SpellDef
 * @property {string} id
 * @property {string} name
 * @property {'orb'|'shard'|'chain'} projectile
 * @property {[number, number, number]} color rgb 0..1 for the projectile, trail and light
 * @property {string} desc shown in the tooltip
 * @property {number} [splash] fraction of damage dealt to enemies next to the target
 * @property {number} [freeze] chance that a hit target freezes
 * @property {number} [freezeTurns]
 * @property {number} [chain] how many targets a bolt can reach in all
 * @property {number} [chainFalloff] damage multiplier per hop
 */

/** @type {Record<string, SpellDef>} */
export const SPELLS = {
  bolt: { id: 'bolt', name: 'Arcane bolt', projectile: 'orb', color: [0.75, 0.45, 1], desc: 'a plain bolt of force' },
  fire: { id: 'fire', name: 'Fireball', projectile: 'orb', color: [1, 0.55, 0.15], desc: 'burns neighbours for half', splash: 0.5 },
  ice: { id: 'ice', name: 'Ice shard', projectile: 'shard', color: [0.6, 0.85, 1], desc: 'may freeze for 3 turns', freeze: 0.35, freezeTurns: 3 },
  chain: { id: 'chain', name: 'Chain lightning', projectile: 'chain', color: [0.8, 0.9, 1], desc: 'jumps to 3 targets', chain: 3, chainFalloff: 0.7 },
  storm: { id: 'storm', name: 'Storm', projectile: 'chain', color: [0.9, 0.85, 1], desc: 'jumps to 5 targets', chain: 5, chainFalloff: 0.8 },
};

/** @param {string} name */
function armorTiers(name) {
  return [
    { name: `Mithril ${name}`, power: 25, value: 200, weight: 50, color: 14 },
    { name: `Plate ${name}`, power: 15, value: 90, weight: 40, color: 15 },
    { name: `Chain ${name}`, power: 10, value: 35, weight: 30, color: 8 },
    { name: `Leather ${name}`, power: 5, value: 10, weight: 20, color: 4 },
  ];
}

/**
 * Relative weights for which category drops. Rings and amulets are rare;
 * weapons split between the three kinds.
 * @type {[string, number][]}
 */
export const CATEGORY_WEIGHTS = [
  ['melee', 10], ['bow', 7], ['staff', 7], ['shield', 8],
  ['helmet', 8], ['armor', 8], ['greaves', 8], ['ring', 3], ['amulet', 3],
];

/**
 * @typedef {object} Affix
 * @property {string} name prefix added to the item name
 * @property {number} cost
 * @property {number} odds 1 in odds/4 chance to be tried
 * @property {string} desc
 * @property {number} [color] item colour override
 * @property {Partial<{str: number, dex: number, int: number, hp: number, xp: number, speed: number, powerMul: number, powerAdd: number, weightMul: number, priceMul: number}>} mods
 */

/** Tried in order; the first that is affordable and rolls is applied. @type {Affix[]} */
export const AFFIXES = [
  { name: 'Mighty', cost: 100, odds: 600, desc: '+2 str', color: 13, mods: { str: 2 } },
  { name: 'Nimble', cost: 100, odds: 600, desc: '+2 dex', color: 13, mods: { dex: 2 } },
  { name: 'Wise', cost: 100, odds: 600, desc: '+2 int', color: 13, mods: { int: 2 } },
  { name: 'Hale', cost: 100, odds: 600, desc: '+10% hp', color: 13, mods: { hp: 10 } },
  { name: 'Keen', cost: 100, odds: 600, desc: '+10% xp', color: 13, mods: { xp: 10 } },
  { name: 'Swift', cost: 120, odds: 600, desc: '+10 speed', color: 13, mods: { speed: 10 } },
  { name: 'Savage', cost: 200, odds: 400, desc: '+50% power', color: 12, mods: { powerAdd: 6, powerMul: 1.5 } },
  { name: 'Fine', cost: 100, odds: 150, desc: '+20% power', color: 12, mods: { powerMul: 1.2 } },
  { name: 'Light', cost: 150, odds: 50, desc: '-50% weight', color: 13, mods: { weightMul: 0.5 } },
  { name: 'Rusty', cost: 10, odds: 40, desc: '-50% power', color: 4, mods: { powerMul: 0.5, priceMul: 0.33 } },
];

/** Rings and amulets are nothing without an affix; one is forced on them. */
export const AFFIX_REQUIRED = new Set(['ring', 'amulet']);

/**
 * @typedef {object} Consumable
 * @property {string} name
 * @property {string} glyph
 * @property {number} color
 * @property {number} heal
 * @property {number} value
 * @property {number} weight
 * @property {number} minBudget
 */

/** @type {Consumable[]} best first; chosen like tiers */
export const CONSUMABLES = [
  { name: 'Healing potion', glyph: 'POTION', color: 12, heal: 60, value: 40, weight: 4, minBudget: 60 },
  { name: 'Ration', glyph: 'FOOD', color: 6, heal: 20, value: 5, weight: 5, minBudget: 0 },
];

/** Lock colours for doors and keys. */
export const KEYS = [
  { name: 'Bronze key', doorName: 'bronze', color: 6 },
  { name: 'Silver key', doorName: 'silver', color: 7 },
  { name: 'Gold key', doorName: 'gold', color: 14 },
];

export const CURRENCY = 'gold';
export const ARROWS_NAME = 'arrows';

/** How many things fit in the pack before the oldest is sold off. */
export const PACK_SIZE = 24;
