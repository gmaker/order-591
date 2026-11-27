import { Config } from '../config.js';
import { Rng } from '../core/Rng.js';
import { CYRILLIC, FONT_X_OFFSET, FONT_Y_OFFSET, fontRows } from './Font.js';
import { SPRITES } from './Sprites.js';

/**
 * The glyph atlas: one 128×128 RGBA texture of 16×16 cells, each 8×8 pixels,
 * built procedurally at startup. White pixels with alpha; colour comes from
 * the vertex tint.
 *
 * Layout:
 *   0..94    printable ASCII 32..126 (index = charCode - 32)
 *   96..111  wall pieces, index = 96 + neighbour mask (1 up, 2 down, 4 left, 8 right)
 *   112..    sprites from Sprites.js in declaration order (ids in G)
 *   160..192 Cyrillic capitals, А..Я then Ё
 *   240..255 fog noise glyphs
 */
export const ATLAS_CELLS = 16;
export const ATLAS_SIZE = ATLAS_CELLS * Config.CELL;

const ASCII_FIRST = 32;
const ASCII_LAST = 126;
const WALL_BASE = 96;
const SPRITE_BASE = 112;
const CYRILLIC_BASE = 160;
const NOISE_BASE = 240;
const NOISE_COUNT = 16;

/** Wall neighbour mask bits. */
export const WALL_UP = 1;
export const WALL_DOWN = 2;
export const WALL_LEFT = 4;
export const WALL_RIGHT = 8;

/** Glyph ids by name. Sprite names come from Sprites.js. */
export const G = Object.freeze({
  SPACE: 0,
  WALL: WALL_BASE,
  NOISE: NOISE_BASE,
  NOISE_COUNT,
  ...Object.fromEntries(Object.keys(SPRITES).map((name, i) => [name, SPRITE_BASE + i])),
});

if (SPRITE_BASE + Object.keys(SPRITES).length > CYRILLIC_BASE) {
  throw new Error('Too many sprites for the atlas layout');
}

/**
 * Glyph id for a character; unknown characters draw as '?'.
 * @param {string} ch single character
 */
export function charToGlyph(ch) {
  const upper = ch.toUpperCase();
  const code = upper.charCodeAt(0);
  if (code >= ASCII_FIRST && code <= ASCII_LAST) return code - ASCII_FIRST;
  const cyr = CYRILLIC.indexOf(upper);
  if (cyr >= 0) return CYRILLIC_BASE + cyr;
  return '?'.charCodeAt(0) - ASCII_FIRST;
}

/**
 * Build the RGBA pixel data for the atlas texture.
 * @returns {Uint8Array} ATLAS_SIZE×ATLAS_SIZE×4 bytes
 */
export function buildAtlas() {
  const data = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);
  const cell = Config.CELL;

  /** @param {number} glyph @param {number} x @param {number} y */
  const plot = (glyph, x, y) => {
    const px = (glyph % ATLAS_CELLS) * cell + x;
    const py = Math.floor(glyph / ATLAS_CELLS) * cell + y;
    const i = (py * ATLAS_SIZE + px) * 4;
    data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 255;
  };

  // Font
  const letter = (glyph, ch) => {
    const rows = fontRows(ch);
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < 5; x++) {
        if (rows[y] & (16 >> x)) plot(glyph, x + FONT_X_OFFSET, y + FONT_Y_OFFSET);
      }
    }
  };
  for (let code = ASCII_FIRST; code <= ASCII_LAST; code++) letter(code - ASCII_FIRST, String.fromCharCode(code));
  for (let i = 0; i < CYRILLIC.length; i++) letter(CYRILLIC_BASE + i, CYRILLIC[i]);

  // Wall pieces: a 2px-thick line from the centre toward each connected side.
  for (let mask = 0; mask < 16; mask++) {
    const glyph = WALL_BASE + mask;
    const draw = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) plot(glyph, x, y);
    };
    draw(3, 3, 4, 4);
    if (mask & WALL_UP) draw(3, 0, 4, 3);
    if (mask & WALL_DOWN) draw(3, 4, 4, 7);
    if (mask & WALL_LEFT) draw(0, 3, 3, 4);
    if (mask & WALL_RIGHT) draw(4, 3, 7, 4);
  }

  // Sprites
  let id = SPRITE_BASE;
  for (const rows of Object.values(SPRITES)) {
    for (let y = 0; y < cell; y++) {
      const row = rows[y] ?? '';
      for (let x = 0; x < cell; x++) if (row[x] === '#') plot(id, x, y);
    }
    id++;
  }

  // Fog noise: sparse static, fixed seed so it never changes between runs.
  const rng = new Rng(0x591);
  for (let n = 0; n < NOISE_COUNT; n++) {
    const glyph = NOISE_BASE + n;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) if (rng.nextInt(6) === 0) plot(glyph, x, y);
    }
  }

  return data;
}
