import { Renderer } from '../gfx/Renderer.js';

/**
 * Small immediate-mode pieces shared by the panel-style screens: buttons
 * and hit rectangles. Everything is drawn in backbuffer pixels.
 */

/** @typedef {{ id: string, x: number, y: number, w: number, h: number }} HitRect */

/**
 * @param {{ x: number, y: number } | null} m
 * @param {number} x @param {number} y @param {number} w @param {number} h
 */
export function inRect(m, x, y, w, h) {
  return m !== null && m.x >= x && m.x < x + w && m.y >= y && m.y < y + h;
}

/**
 * The first rectangle under a point.
 * @param {HitRect[]} hits @param {number} x @param {number} y
 */
export function hitAt(hits, x, y) {
  for (const h of hits) if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h;
  return null;
}

/**
 * A framed button with centred text. `hot` is hovered or keyboard-selected;
 * `primary` gets the warm frame even when cold.
 * @param {Renderer} ui
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {string} label
 * @param {boolean} hot
 * @param {boolean} [primary]
 * @param {boolean} [enabled]
 */
export function drawButton(ui, x, y, w, h, label, hot, primary = false, enabled = true) {
  const lit = hot && enabled;
  ui.uiRect(x, y, w, h, lit ? 0.16 : 0.1, lit ? 0.15 : 0.1, lit ? 0.12 : 0.13, 1);
  if (lit) ui.uiFrame(x, y, w, h, 1, 0.9, 0.5, 1);
  else if (primary && enabled) ui.uiFrame(x, y, w, h, 0.7, 0.6, 0.35, 1);
  else ui.uiFrame(x, y, w, h, 0.3, 0.3, 0.35, 1);
  const color = !enabled ? 8 : lit ? 15 : primary ? 14 : 7;
  ui.uiText(x + ((w - Renderer.uiTextWidth(label)) >> 1), y + ((h - 8) >> 1), label, color);
}

/**
 * Panel background in the side panel's style.
 * @param {Renderer} ui
 * @param {number} x @param {number} y @param {number} w @param {number} h
 */
export function drawPanel(ui, x, y, w, h) {
  ui.uiRect(x, y, w, h, 0.06, 0.06, 0.09, 0.96);
  ui.uiFrame(x, y, w, h, 0.4, 0.4, 0.46, 1);
  ui.uiFrame(x + 3, y + 3, w - 6, h - 6, 0.18, 0.18, 0.22, 1);
}
