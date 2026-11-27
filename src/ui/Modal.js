import { Config } from '../config.js';
import { Action } from '../core/Input.js';
import { Renderer } from '../gfx/Renderer.js';

/** @typedef {{ id: string, label: string }} ModalButton */
/** @typedef {{ text: string, color?: number, scale?: number }} ModalLine */

const PAD = 14;
const LINE_H = 11;
const BTN_H = 18;
const BTN_PAD = 10;
const BTN_GAP = 10;

/**
 * A window in the side panel's style over a dimmed screen: title, a few
 * centred lines and a row of buttons. Mouse or keys; the scene that owns it
 * asks update() every tick for the button that was chosen.
 */
export class Modal {
  #title;
  #titleColor;
  /** @type {ModalLine[]} */ #lines;
  /** @type {ModalButton[]} */ #buttons;
  #width;
  #height;
  #selected = 0;
  /** @type {{ x: number, y: number } | null} */ #mouse = null;
  /** Button rectangles from the last render, for hit tests. @type {{ x: number, y: number, w: number, h: number }[]} */
  #rects = [];

  /**
   * @param {object} o
   * @param {string} o.title
   * @param {number} [o.titleColor]
   * @param {ModalLine[]} o.lines
   * @param {ModalButton[]} o.buttons at least one; the last answers Escape
   * @param {number} [o.width]
   */
  constructor({ title, titleColor = 14, lines, buttons, width = 280 }) {
    this.#title = title;
    this.#titleColor = titleColor;
    this.#lines = lines;
    this.#buttons = buttons;
    this.#width = width;
    let body = 0;
    for (const l of lines) body += LINE_H * (l.scale ?? 1) + (l.text === '' ? -4 : 0);
    this.#height = PAD + 20 + 10 + body + 12 + BTN_H + PAD;
  }

  get x() { return (Config.WIDTH - this.#width) >> 1; }
  get y() { return (Config.HEIGHT - this.#height) >> 1; }

  /**
   * @param {import('../core/Input.js').Input} input
   * @returns {string|null} id of the chosen button
   */
  update(input) {
    this.#mouse = input.mouse;
    const n = this.#buttons.length;
    const dir = input.direction();
    if (dir !== null && (dir.x !== 0 || dir.y !== 0)) {
      const step = dir.x !== 0 ? dir.x : dir.y;
      this.#selected = (this.#selected + step + n) % n;
    }
    if (input.isPressed(Action.CONFIRM)) return this.#buttons[this.#selected].id;
    if (input.isPressed(Action.CANCEL)) return this.#buttons[n - 1].id;
    const hot = this.#hotButton();
    if (hot >= 0) this.#selected = hot;
    for (const click of input.clicks()) {
      if (click.button !== 0) continue;
      const i = this.#rects.findIndex(r => click.x >= r.x && click.x < r.x + r.w && click.y >= r.y && click.y < r.y + r.h);
      if (i >= 0) return this.#buttons[i].id;
    }
    return null;
  }

  /** @param {Renderer} ui */
  render(ui) {
    ui.uiRect(0, 0, Config.WIDTH, Config.HEIGHT, 0, 0, 0, 0.6);
    const x = this.x;
    const y = this.y;
    const w = this.#width;
    const h = this.#height;
    ui.uiRect(x, y, w, h, 0.06, 0.06, 0.09, 0.98);
    ui.uiFrame(x, y, w, h, 0.4, 0.4, 0.46, 1);
    ui.uiFrame(x + 3, y + 3, w - 6, h - 6, 0.18, 0.18, 0.22, 1);

    let cy = y + PAD;
    ui.uiText(x + ((w - Renderer.uiTextWidth(this.#title, 2)) >> 1), cy, this.#title, this.#titleColor, 2);
    cy += 20;
    ui.uiRect(x + PAD, cy + 3, w - PAD * 2, 1, 0.3, 0.3, 0.35, 1);
    cy += 10;
    for (const l of this.#lines) {
      const scale = l.scale ?? 1;
      if (l.text === '') { cy += LINE_H - 4; continue; }
      ui.uiText(x + ((w - Renderer.uiTextWidth(l.text, scale)) >> 1), cy, l.text, l.color ?? 7, scale);
      cy += LINE_H * scale;
    }
    cy += 12;

    const widths = this.#buttons.map(b => Renderer.uiTextWidth(b.label) + BTN_PAD * 2);
    const total = widths.reduce((a, b) => a + b, 0) + BTN_GAP * (widths.length - 1);
    let bx = x + ((w - total) >> 1);
    this.#rects = [];
    this.#buttons.forEach((b, i) => {
      const bw = widths[i];
      const on = i === this.#selected;
      ui.uiRect(bx, cy, bw, BTN_H, on ? 0.16 : 0.1, on ? 0.15 : 0.1, on ? 0.12 : 0.13, 1);
      ui.uiFrame(bx, cy, bw, BTN_H, on ? 1 : 0.3, on ? 0.9 : 0.3, on ? 0.5 : 0.35, 1);
      ui.uiText(bx + BTN_PAD, cy + 5, b.label, on ? 15 : 8);
      this.#rects.push({ x: bx, y: cy, w: bw, h: BTN_H });
      bx += bw + BTN_GAP;
    });
  }

  #hotButton() {
    const m = this.#mouse;
    if (m === null) return -1;
    return this.#rects.findIndex(r => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h);
  }
}
