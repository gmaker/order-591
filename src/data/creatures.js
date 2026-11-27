/**
 * Enemy types, weakest first. Each entry's hp/atk/def are percentages of
 * the ramp at its position in the list (see RAMP and EnemyTemplate), so the
 * list is a smooth climb and reordering it is most of the balance pass.
 *
 * `kind` picks the 3D body (Models: BLOB, BEAST, HUMANOID, BRUTE, BAT,
 * KNIGHT, SPIDER); `color` is a palette index.
 */

export const Kind = Object.freeze({ BLOB: 0, BEAST: 1, HUMANOID: 2, BRUTE: 3, BAT: 4, KNIGHT: 5, SPIDER: 6 });

/**
 * How a 100% creature grows with its position in the list: the value at
 * slot i comes from applying `v = v * mul + add` i times to base. Hit
 * points and defence follow the original jam game's counter (5, 7, 9, 11,
 * 14, ... 96); attack climbs slower so the last floors are long fights
 * rather than one-hit deaths.
 */
export const RAMP = Object.freeze({
  hp: { base: 5, mul: 1.1, add: 2 },
  atk: { base: 5, mul: 1.07, add: 1.5 },
  def: { base: 5, mul: 1.1, add: 2 },
  xp: { base: 14, mul: 1.17, add: 0 },
});

/**
 * @typedef {object} CreatureDef
 * @property {string} name
 * @property {number} hp percent of the ramp
 * @property {number} atk percent of the ramp
 * @property {number} def percent of the ramp
 * @property {number} spd actions per 100 scheduler units
 * @property {number} kind
 * @property {number} color
 */

/** @type {CreatureDef[]} */
export const CREATURES = [
  { name: 'Rat', hp: 100, atk: 100, def: 100, spd: 140, kind: Kind.BEAST, color: 6 },
  { name: 'Slime', hp: 150, atk: 60, def: 160, spd: 50, kind: Kind.BLOB, color: 10 },
  { name: 'Spider', hp: 50, atk: 130, def: 80, spd: 130, kind: Kind.SPIDER, color: 8 },
  { name: 'Bat', hp: 20, atk: 70, def: 100, spd: 110, kind: Kind.BAT, color: 7 },
  { name: 'Ooze', hp: 150, atk: 60, def: 160, spd: 50, kind: Kind.BLOB, color: 2 },
  { name: 'Goblin', hp: 70, atk: 60, def: 130, spd: 100, kind: Kind.HUMANOID, color: 10 },
  { name: 'Wolf', hp: 100, atk: 100, def: 100, spd: 140, kind: Kind.BEAST, color: 7 },
  { name: 'Skeleton', hp: 150, atk: 60, def: 160, spd: 50, kind: Kind.HUMANOID, color: 15 },
  { name: 'Ghoul', hp: 20, atk: 70, def: 100, spd: 110, kind: Kind.HUMANOID, color: 3 },
  { name: 'Cultist', hp: 70, atk: 60, def: 130, spd: 100, kind: Kind.KNIGHT, color: 5 },
  { name: 'Orc', hp: 200, atk: 150, def: 50, spd: 80, kind: Kind.BRUTE, color: 2 },
  { name: 'Mercenary', hp: 150, atk: 100, def: 100, spd: 100, kind: Kind.KNIGHT, color: 6 },
  { name: 'Spider queen', hp: 50, atk: 130, def: 80, spd: 130, kind: Kind.SPIDER, color: 13 },
  { name: 'Troll', hp: 200, atk: 150, def: 50, spd: 80, kind: Kind.BRUTE, color: 9 },
  { name: 'Wraith', hp: 150, atk: 60, def: 160, spd: 50, kind: Kind.BAT, color: 11 },
  { name: 'Dark knight', hp: 150, atk: 100, def: 100, spd: 100, kind: Kind.KNIGHT, color: 8 },
  { name: 'Dire wolf', hp: 100, atk: 100, def: 100, spd: 140, kind: Kind.BEAST, color: 15 },
  { name: 'Ogre', hp: 200, atk: 150, def: 50, spd: 80, kind: Kind.BRUTE, color: 4 },
  { name: 'Lich', hp: 50, atk: 130, def: 80, spd: 130, kind: Kind.HUMANOID, color: 12 },
];
