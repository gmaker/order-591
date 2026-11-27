/**
 * Colour indices used everywhere in the game (§-codes in strings use the hex
 * digit of the base colour):
 *
 *   0..15  CGA-style base colours: bit2 = red, bit1 = green, bit0 = blue,
 *          index > 7 adds brightness. 7 is light grey, 8 dark grey, 15 white.
 *   16..31 the same colours, dimmed: used for remembered-but-not-visible cells.
 *   32     fog: a flat dark square, glyph and background identical.
 *
 * Black is lifted to rgb(60,60,60), so every drawn cell shows as a dark grey
 * square on the pure-black canvas. That three-level background (black unknown,
 * darker remembered, grey visible) is what makes the map readable.
 */
export const DARK = 16;
export const FOG = 32;
export const PALETTE_SIZE = 33;

/** Lift a 0..255 channel the way the original font sheet did. */
const lift = v => Math.floor((v * 195) / 255) + 60;

/** @param {number} index 0..32 @returns {[number, number, number]} */
function baseRGB(index) {
  const c = index & 15;
  const bright = c > 7 ? 85 : 0;
  return [((c >> 2) & 1) * 170 + bright, ((c >> 1) & 1) * 170 + bright, (c & 1) * 170 + bright];
}

/**
 * @param {[number, number, number]} rgb already lifted
 * @param {number} index
 * @returns {[number, number, number]}
 */
function shade(rgb, index) {
  if (index === FOG) return [24, 24, 24];
  if (index >= DARK) return /** @type {[number, number, number]} */ (rgb.map(v => Math.floor(v / 5) + 24));
  return rgb;
}

/** Foreground (glyph) colours, 3 floats per index, 0..1. */
export const FG = new Float32Array(PALETTE_SIZE * 3);
/** Background (cell) colours, 3 floats per index, 0..1. */
export const BG = new Float32Array(PALETTE_SIZE * 3);

for (let i = 0; i < PALETTE_SIZE; i++) {
  const fg = shade(/** @type {[number, number, number]} */ (baseRGB(i).map(lift)), i);
  const bg = shade([lift(0), lift(0), lift(0)], i);
  for (let k = 0; k < 3; k++) {
    FG[i * 3 + k] = fg[k] / 255;
    BG[i * 3 + k] = bg[k] / 255;
  }
}

/**
 * Clamp any colour index into the palette.
 * @param {number} index
 */
export function clampColor(index) {
  if (index < 0) return 0;
  if (index >= PALETTE_SIZE) return PALETTE_SIZE - 1;
  return index | 0;
}
