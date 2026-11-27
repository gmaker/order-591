/**
 * Biomes by depth. A biome is only looks and dressing: colours, light,
 * grass, trees and decoration. The generator and the monsters do not care.
 */

/** @typedef {[number, number, number]} RGB */

/**
 * @typedef {object} BiomeDef
 * @property {string} id
 * @property {string} name shown when arriving
 * @property {number} minDepth first level that uses it
 * @property {RGB} floor
 * @property {RGB} wall
 * @property {number} grass share of the floor covered by grass (noise-shaped meadows)
 * @property {RGB} grassColor
 * @property {number} trees chance per open floor cell (solid, block movement and sight)
 * @property {'none'|'bones'|'mushroom'|'crystal'} decor
 * @property {number} decorDensity chance per floor cell
 * @property {RGB} ambient
 * @property {RGB} sun
 * @property {RGB} torch colour of the player's light
 * @property {number} remembered brightness of cells seen before but not now
 */

/** @type {BiomeDef[]} */
export const BIOMES = [
  {
    id: 'courtyard', name: 'the overgrown courtyard', minDepth: 1,
    floor: [0.42, 0.5, 0.36], wall: [0.64, 0.62, 0.56],
    grass: 0.45, grassColor: [0.35, 0.62, 0.3], trees: 0.05,
    decor: 'none', decorDensity: 0,
    ambient: [0.5, 0.52, 0.56], sun: [0.65, 0.65, 0.6], torch: [1, 0.85, 0.6], remembered: 0.42,
  },
  {
    id: 'crypt', name: 'the crypt', minDepth: 4,
    floor: [0.44, 0.44, 0.48], wall: [0.56, 0.56, 0.64],
    grass: 0.04, grassColor: [0.4, 0.45, 0.3], trees: 0,
    decor: 'bones', decorDensity: 0.08,
    ambient: [0.36, 0.38, 0.5], sun: [0.45, 0.45, 0.55], torch: [1, 0.8, 0.55], remembered: 0.36,
  },
  {
    id: 'caverns', name: 'the caverns', minDepth: 9,
    floor: [0.46, 0.4, 0.33], wall: [0.52, 0.44, 0.38],
    grass: 0.1, grassColor: [0.55, 0.6, 0.3], trees: 0,
    decor: 'mushroom', decorDensity: 0.1,
    ambient: [0.36, 0.42, 0.38], sun: [0.4, 0.5, 0.4], torch: [0.9, 0.9, 0.6], remembered: 0.34,
  },
  {
    id: 'deep', name: 'the deep', minDepth: 13,
    floor: [0.36, 0.3, 0.42], wall: [0.44, 0.38, 0.52],
    grass: 0, grassColor: [0.4, 0.3, 0.5], trees: 0,
    decor: 'crystal', decorDensity: 0.07,
    ambient: [0.3, 0.28, 0.42], sun: [0.4, 0.35, 0.55], torch: [0.9, 0.7, 1], remembered: 0.3,
  },
];

/** @param {number} depth */
export function biomeForDepth(depth) {
  let biome = BIOMES[0];
  for (const b of BIOMES) if (depth >= b.minDepth) biome = b;
  return biome;
}
