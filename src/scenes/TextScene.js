import { Config } from '../config.js';
import { Action } from '../core/Input.js';
import { Renderer } from '../gfx/Renderer.js';
import { t } from '../i18n.js';
import { drawButton, drawPanel, hitAt } from '../ui/Widgets.js';
import { Scene } from './Scene.js';

const WIN_W = 600;
const WIN_H = 400;
const PAD = 16;
const LINE_H = 11;
const BTN_H = 20;

/**
 * Pages of text in a window over whatever is running: title, lines with
 * §-colours, previous / next / close buttons. Space, Enter and the arrows
 * turn pages, Escape closes. When the last page is passed, onDone is called
 * with the scene so the caller decides what comes next.
 */
export class TextScene extends Scene {
  /** @type {import('../i18n.js').Page[]} */ #pages;
  #page = 0;
  /** @type {(scene: TextScene) => void} */ #onDone;
  /** @type {import('../ui/Widgets.js').HitRect[]} */ #hits = [];
  /** @type {string|null} */ #hot = null;

  /**
   * @param {import('../i18n.js').Page[]} pages
   * @param {(scene: TextScene) => void} onDone
   */
  constructor(pages, onDone) {
    super();
    this.#pages = pages;
    this.#onDone = onDone;
  }

  get opaque() { return false; }

  update(input) {
    const m = input.mouse;
    this.#hot = m === null ? null : hitAt(this.#hits, m.x, m.y)?.id ?? null;
    if (input.isPressed(Action.CONFIRM) || input.isTriggered(Action.RIGHT) || input.isTriggered(Action.DOWN)) this.#press('next');
    else if (input.isTriggered(Action.LEFT) || input.isTriggered(Action.UP)) this.#press('prev');
    else if (input.isPressed(Action.CANCEL)) this.#press('close');
    for (const click of input.clicks()) {
      if (click.button !== 0) continue;
      const hit = hitAt(this.#hits, click.x, click.y);
      if (hit !== null) this.#press(hit.id);
    }
  }

  /** @param {string} id */
  #press(id) {
    if (id === 'next') {
      if (this.#page < this.#pages.length - 1) this.#page++;
      else this.#onDone(this);
    } else if (id === 'prev') {
      if (this.#page > 0) this.#page--;
    } else if (id === 'close') {
      this.#onDone(this);
    }
  }

  render(screen) {
    screen.clear();
  }

  renderUi(ui) {
    this.#hits = [];
    const page = this.#pages[this.#page];
    if (page === undefined) return;
    const x = (Config.WIDTH - WIN_W) >> 1;
    const y = (Config.HEIGHT - WIN_H) >> 1;
    ui.uiRect(0, 0, Config.WIDTH, Config.HEIGHT, 0, 0, 0, 0.6);
    drawPanel(ui, x, y, WIN_W, WIN_H);

    ui.uiText(x + PAD, y + 12, page.title, 14, 2);
    const counter = `${this.#page + 1}/${this.#pages.length}`;
    ui.uiText(x + WIN_W - PAD - Renderer.uiTextWidth(counter), y + 16, counter, 8);
    ui.uiRect(x + PAD, y + 38, WIN_W - PAD * 2, 1, 0.3, 0.3, 0.35, 1);

    let ly = y + 50;
    for (const line of page.lines) {
      if (line.length > 2) {
        const color = parseInt(line[0], 16);
        ui.uiText(x + PAD, ly, line.slice(2), Number.isNaN(color) ? 7 : color);
      }
      ly += LINE_H;
    }

    const by = y + WIN_H - PAD - BTN_H;
    const last = this.#page === this.#pages.length - 1;
    const prev = `< ${t('PREVIOUS')}`;
    const next = last ? t('DONE') : `${t('NEXT')} >`;
    const close = t('CLOSE');
    const bw = s => Renderer.uiTextWidth(s) + 20;
    if (this.#page > 0) this.#button(ui, x + PAD, by, bw(prev), prev, 'prev', false);
    this.#button(ui, x + WIN_W - PAD - bw(next), by, bw(next), next, 'next', true);
    if (!last) this.#button(ui, x + ((WIN_W - bw(close)) >> 1), by, bw(close), close, 'close', false);
  }

  /**
   * @param {Renderer} ui @param {number} x @param {number} y @param {number} w
   * @param {string} label @param {string} id @param {boolean} primary
   */
  #button(ui, x, y, w, label, id, primary) {
    drawButton(ui, x, y, w, BTN_H, label, this.#hot === id, primary);
    this.#hits.push({ id, x, y, w, h: BTN_H });
  }
}
