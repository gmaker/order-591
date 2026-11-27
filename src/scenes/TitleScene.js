import { Config } from '../config.js';
import { Action } from '../core/Input.js';
import { Rng } from '../core/Rng.js';
import { GRASS_VARIANTS, Model } from '../gfx3d/Models.js';
import { Renderer } from '../gfx/Renderer.js';
import { language, nextLanguage, pages, t } from '../i18n.js';
import { CharGenScene } from './CharGenScene.js';
import { HelpScene } from './HelpScene.js';
import { Scene } from './Scene.js';
import { TextScene } from './TextScene.js';

/** Menu labels in the current language. */
const menu = () => [t('NEW GAME'), t('THE STORY'), t('HELP'), t('LANGUAGE: {lang}', { lang: language().name.toUpperCase() })];
const MENU_Y = (Config.HEIGHT * 0.5) | 0;
const MENU_STEP = 26;
const MENU_SCALE = 2;
const FIELD = 14;

/**
 * Main menu: the title, three choices, and behind them a dark field of
 * grass around the bell, with ash drifting up. Keys or mouse, either works.
 */
export class TitleScene extends Scene {
  #selected = 0;
  /** @type {{ x: number, z: number, yaw: number, h: number, g: number }[]} */ #grass = [];
  /** @type {{ x: number, z: number, yaw: number }[]} */ #ruins = [];
  #ash = 0;

  constructor() {
    super();
    const rng = new Rng(591);
    for (let i = 0; i < 420; i++) {
      this.#grass.push({
        x: (rng.nextFloat() - 0.5) * FIELD * 2,
        z: (rng.nextFloat() - 0.5) * FIELD * 2,
        yaw: rng.nextFloat() * Math.PI,
        h: 0.7 + rng.nextFloat() * 0.8,
        g: 0.55 + rng.nextFloat() * 0.45,
      });
    }
    for (let i = 0; i < 14; i++) {
      const a = rng.nextFloat() * Math.PI * 2;
      const r = 3 + rng.nextFloat() * 5;
      this.#ruins.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, yaw: rng.nextFloat() * Math.PI });
    }
  }

  get hasWorld() { return true; }
  get opaque() { return false; }

  // ── Input ────────────────────────────────────────────────────────────────

  update(input) {
    const n = menu().length;
    if (input.isTriggered(Action.UP)) this.#selected = (this.#selected + n - 1) % n;
    if (input.isTriggered(Action.DOWN)) this.#selected = (this.#selected + 1) % n;
    if (input.isPressed(Action.CONFIRM)) this.#activate(this.#selected);

    const mouse = input.mouse;
    if (mouse !== null) {
      const row = this.#rowAt(mouse.x, mouse.y);
      if (row !== -1) this.#selected = row;
    }
    for (const click of input.clicks()) {
      if (click.button !== 0) continue;
      const row = this.#rowAt(click.x, click.y);
      if (row !== -1) this.#activate(row);
    }
  }

  /** @param {number} x @param {number} y */
  #rowAt(x, y) {
    const labels = menu();
    for (let i = 0; i < labels.length; i++) {
      const w = Renderer.uiTextWidth(labels[i], MENU_SCALE) + 40;
      const x0 = (Config.WIDTH - w) >> 1;
      const y0 = MENU_Y + i * MENU_STEP - 4;
      if (x >= x0 && x < x0 + w && y >= y0 && y < y0 + MENU_STEP) return i;
    }
    return -1;
  }

  /** @param {number} row */
  #activate(row) {
    if (row === 0) this.scenes.change(new CharGenScene());
    else if (row === 1) this.scenes.push(new TextScene(pages('intro'), s => s.scenes.pop()));
    else if (row === 2) this.scenes.push(new HelpScene());
    else nextLanguage();
  }

  // ── Drawing ──────────────────────────────────────────────────────────────

  renderWorld(world, dt, time) {
    const cam = world.camera;
    cam.zoom = 30;
    cam.yaw = Math.PI / 4 + Math.sin(time * 0.07) * 0.5;
    cam.target = [Math.sin(time * 0.05) * 1.5, 0.2, Math.cos(time * 0.04) * 1.5];

    world.setAmbient(0.16, 0.17, 0.24);
    world.setSun(-0.3, 1, 0.2, 0.22, 0.24, 0.34);
    world.add(Model.FLOOR, 0, 0, 0, 0, FIELD * 2.2, 1, FIELD * 2.2, 0.16, 0.19, 0.16, 1);

    this.#grass.forEach((g, i) => {
      world.add(GRASS_VARIANTS[i % 3], g.x, 0, g.z, g.yaw, 1.4, g.h * 1.8, 1.4, 0.3 * g.g, 0.5 * g.g, 0.3 * g.g, 1, 0, 1.4);
    });
    for (const r of this.#ruins) {
      world.add(Model.WALL, r.x, 0, r.z, 0, 1, 0.9, 1, 0.5, 0.5, 0.55, 1);
      world.add(Model.WALL_ARM, r.x, 0, r.z, r.yaw, 1, 0.9, 1, 0.5, 0.5, 0.55, 1);
    }

    const pulse = 0.6 + Math.sin(time * 1.3) * 0.25;
    world.add(Model.BEACON, 0, 0, 0, time * 0.2, 1.6, 1.6, 1.6, 0.7, 0.85, 1, 1, pulse);
    world.addLight(0, 1.8, 0, 7, 0.5 * pulse, 0.7 * pulse, 1 * pulse);

    // Ash drifting up through the field.
    this.#ash += dt * 40;
    while (this.#ash > 1) {
      this.#ash--;
      const x = (Math.random() - 0.5) * FIELD * 1.6;
      const z = (Math.random() - 0.5) * FIELD * 1.6;
      world.particles.spawn({
        x, y: 0.1, z, vx: (Math.random() - 0.5) * 0.3, vy: 0.25 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.3,
        life: 3 + Math.random() * 3, size: 0.06 + Math.random() * 0.06, r: 0.55, g: 0.6, b: 0.75, gravity: -0.05,
      });
    }
    world.particles.update(dt);
  }

  render(screen) {
    screen.clear();
  }

  renderUi(ui, input) {
    const W = Config.WIDTH;
    const title = 'ORDER 591';
    const tw = Renderer.uiTextWidth(title, 5);
    ui.uiRect(0, 44, W, 70, 0, 0, 0, 0.45);
    ui.uiText(((W - tw) >> 1) + 3, 57, title, 0, 5);
    ui.uiText((W - tw) >> 1, 54, title, 14, 5);
    const sub = t('need rescue per order 5.9.1');
    ui.uiText((W - Renderer.uiTextWidth(sub)) >> 1, 98, sub, 8);

    const labels = menu();
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const w = Renderer.uiTextWidth(label, MENU_SCALE);
      const x = (W - w) >> 1;
      const y = MENU_Y + i * MENU_STEP;
      const active = i === this.#selected;
      if (active) {
        ui.uiRect(x - 20, y - 4, w + 40, MENU_STEP - 2, 0.9, 0.8, 0.3, 0.12);
        ui.uiText(x - 18, y, '>', 14, MENU_SCALE);
      }
      ui.uiText(x, y, label, active ? 14 : 7, MENU_SCALE);
    }

    const hint = t('arrows + space, or the mouse');
    ui.uiText((W - Renderer.uiTextWidth(hint)) >> 1, Config.HEIGHT - 24, hint, 8);
  }
}
