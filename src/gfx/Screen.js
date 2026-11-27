import { Config } from '../config.js';
import { charToGlyph, G } from './Atlas.js';
import { clampColor } from './Palette.js';

/**
 * A grid of glyph cells (COLS×ROWS). Scenes draw into it with set() and
 * drawString(); the Renderer turns it into textured quads once per frame.
 *
 * Strings support the original §-colour codes: "§c" switches the colour to
 * palette index 0xc for the rest of the string.
 *
 * Text scenes designed for a 40×30 layout call centerBlock(40, 30) after
 * clear(): every coordinate is then offset so the block sits in the middle.
 */
export class Screen {
  /** @type {Uint16Array} glyph id per cell */ #glyphs;
  /** @type {Uint8Array} colour index per cell */ #colors;
  #cols;
  #rows;
  #offsetX = 0;
  #offsetY = 0;
  #blockCols;
  #blockRows;

  /** @param {number} cols @param {number} rows */
  constructor(cols = Config.COLS, rows = Config.ROWS) {
    this.#cols = cols;
    this.#rows = rows;
    this.#blockCols = cols;
    this.#blockRows = rows;
    this.#glyphs = new Uint16Array(cols * rows);
    this.#colors = new Uint8Array(cols * rows);
  }

  get cols() { return this.#cols; }
  get rows() { return this.#rows; }
  /** Width of the current drawing block (whole screen unless centerBlock was called). */
  get blockCols() { return this.#blockCols; }
  get blockRows() { return this.#blockRows; }

  /** @param {number} i cell index */
  glyphAt(i) { return this.#glyphs[i]; }
  /** @param {number} i cell index */
  colorAt(i) { return this.#colors[i]; }

  /**
   * Offset all further drawing so a w×h block is centred on screen.
   * @param {number} w @param {number} h
   */
  centerBlock(w, h) {
    this.#blockCols = w;
    this.#blockRows = h;
    this.#offsetX = Math.max(0, (this.#cols - w) >> 1);
    this.#offsetY = Math.max(0, (this.#rows - h) >> 1);
  }

  /** Draw relative to the whole screen again. */
  resetBlock() {
    this.#blockCols = this.#cols;
    this.#blockRows = this.#rows;
    this.#offsetX = 0;
    this.#offsetY = 0;
  }

  /**
   * @param {number} x @param {number} y block coordinates
   * @param {number} glyph atlas glyph id
   * @param {number} color palette index
   */
  set(x, y, glyph, color) {
    x += this.#offsetX;
    y += this.#offsetY;
    if (x < 0 || y < 0 || x >= this.#cols || y >= this.#rows) return;
    const i = x + y * this.#cols;
    this.#glyphs[i] = glyph;
    this.#colors[i] = clampColor(color);
  }

  /** Clear everything and reset the drawing block. */
  clear() {
    this.#glyphs.fill(G.SPACE);
    this.#colors.fill(0);
    this.resetBlock();
  }

  /**
   * Clear a rectangle [x0,x1)×[y0,y1) in block coordinates.
   * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
   */
  clearRect(x0, y0, x1, y1) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) this.set(x, y, G.SPACE, 0);
    }
  }

  /**
   * Draw text; "§h" (h = hex digit) changes colour mid-string.
   * @param {string} text @param {number} x @param {number} y @param {number} color
   */
  drawString(text, x, y, color) {
    let col = color;
    let cx = x;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '§' && i + 1 < text.length) {
        col = parseInt(text[i + 1], 16);
        if (Number.isNaN(col)) col = color;
        i++;
        continue;
      }
      this.set(cx, y, charToGlyph(ch), col);
      cx++;
    }
  }

  /**
   * Visible length of a string (ignoring §-codes).
   * @param {string} text
   */
  static textWidth(text) {
    let n = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '§' && i + 1 < text.length) { i++; continue; }
      n++;
    }
    return n;
  }

  /** Centre within the current block. */
  drawStringCenter(text, y, color) {
    this.drawString(text, (this.#blockCols - Screen.textWidth(text)) >> 1, y, color);
  }

  /** Right-aligned so the last character lands at column x-1. */
  drawStringRight(text, x, y, color) {
    this.drawString(text, x - Screen.textWidth(text), y, color);
  }
}
