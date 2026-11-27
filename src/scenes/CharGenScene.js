import { Config } from '../config.js';
import { Action } from '../core/Input.js';
import { globalRng } from '../core/Rng.js';
import { CLASSES, GENDERS, RACES } from '../data/characters.js';
import { ItemSpawner } from '../game/item/ItemSpawner.js';
import { Player } from '../game/mob/Player.js';
import { Model } from '../gfx3d/Models.js';
import { paletteRGB } from '../game/WorldView.js';
import { Renderer } from '../gfx/Renderer.js';
import { language, t, tn } from '../i18n.js';
import { drawButton, drawPanel, hitAt } from '../ui/Widgets.js';
import { GameScene } from './GameScene.js';
import { Scene } from './Scene.js';
import { TitleScene } from './TitleScene.js';

const MAX_NAME = 10;

/** The form card, in backbuffer pixels. */
const CARD_X = 24;
const CARD_Y = 24;
const CARD_W = 410;
const CARD_H = Config.HEIGHT - 48;
const PAD = 14;
/** Rows: label column, control column, row pitch. */
const ROW_Y = CARD_Y + 56;
const ROW_H = 30;
const LABEL_X = CARD_X + PAD;
const CTRL_X = CARD_X + 92;
const ARROW = 20;
const VALUE_W = 150;
const BTN_H = 20;
/** Preview zoom and how far right of centre the figure stands, in pixels. */
const PREVIEW_ZOOM = 120;
const PREVIEW_OFFSET = 190;

/** Rows that can hold keyboard focus, in order. */
const ROWS = ['name', 'gender', 'race', 'class'];

/** Syllables for the random-name button, per language. */
const SYLLABLES = {
  en: ['ka', 'ro', 've', 'li', 'an', 'mir', 'tho', 'sel', 'dra', 'en', 'is', 'ul', 'bra', 'ne', 'or', 'wyn', 'da', 'fe', 'gal', 'ri'],
  ru: ['ка', 'ро', 'ве', 'ли', 'ан', 'мир', 'то', 'сел', 'дра', 'ен', 'ис', 'ул', 'бра', 'не', 'ор', 'вин', 'да', 'фе', 'гал', 'ри'],
};

/**
 * Character creation: name, gender, race and class picked with arrow
 * buttons, stats on the card, the actual in-game figure turning on the
 * right. Mouse first; arrows, letters, Enter and Escape still work.
 */
export class CharGenScene extends Scene {
  #player = new Player();
  #row = 0;
  #race = RACES[0];
  #job = CLASSES[0];
  #gender = GENDERS[0];
  /** @type {import('../ui/Widgets.js').HitRect[]} rebuilt every frame */ #hits = [];
  /** @type {{ x: number, y: number } | null} */ #mouse = null;
  /** @type {string|null} id under the mouse */ #hot = null;

  get hasWorld() { return true; }
  get opaque() { return false; }

  update(input) {
    input.textMode = ROWS[this.#row] === 'name';
    const player = this.#player;
    this.#mouse = input.mouse;
    this.#hot = this.#mouse === null ? null : hitAt(this.#hits, this.#mouse.x, this.#mouse.y)?.id ?? null;

    if (ROWS[this.#row] === 'name') {
      for (const ch of input.typed()) {
        if (ch === '\b') player.name = player.name.slice(0, -1);
        else if (/^[a-zа-яё]$/i.test(ch) && player.name.length < MAX_NAME) player.name += ch.toUpperCase();
      }
    }

    if (input.isTriggered(Action.UP)) this.#row = (this.#row + ROWS.length - 1) % ROWS.length;
    if (input.isTriggered(Action.DOWN)) this.#row = (this.#row + 1) % ROWS.length;
    if (input.isTriggered(Action.LEFT)) this.#cycle(ROWS[this.#row], -1);
    if (input.isTriggered(Action.RIGHT)) this.#cycle(ROWS[this.#row], 1);
    if (input.isPressed(Action.CONFIRM)) this.#start();
    if (input.isPressed(Action.CANCEL)) this.scenes.change(new TitleScene());

    for (const click of input.clicks()) {
      if (click.button !== 0) continue;
      const hit = hitAt(this.#hits, click.x, click.y);
      if (hit !== null) this.#press(hit.id);
    }
  }

  /** @param {string} id */
  #press(id) {
    const [row, dir] = id.split(':');
    const index = ROWS.indexOf(row);
    if (index >= 0) {
      this.#row = index;
      if (dir === '-') this.#cycle(row, -1);
      else if (dir === '+') this.#cycle(row, 1);
      return;
    }
    if (id === 'random') this.#player.name = randomName();
    else if (id === 'reroll') this.#player.reroll();
    else if (id === 'begin') this.#start();
    else if (id === 'back') this.scenes.change(new TitleScene());
  }

  /** @param {string} row @param {number} step */
  #cycle(row, step) {
    const next = (list, current) => list[(list.indexOf(current) + step + list.length) % list.length];
    if (row === 'gender') this.#gender = next(GENDERS, this.#gender);
    else if (row === 'race') this.#race = next(RACES, this.#race);
    else if (row === 'class') this.#job = next(CLASSES, this.#job);
  }

  #start() {
    const player = this.#player;
    if (player.name.length === 0) player.name = randomName();
    player.gender = this.#gender;
    player.applyOrigin(this.#race, this.#job);
    const weapon = new ItemSpawner(globalRng).spawnNamed(this.#job.startWeapon);
    player.addItem(weapon);
    player.equip(weapon);
    this.scenes.change(new GameScene(player));
  }

  // ── Drawing ──────────────────────────────────────────────────────────────

  renderWorld(world, dt, time) {
    const cam = world.camera;
    cam.zoom = PREVIEW_ZOOM;
    const shift = PREVIEW_OFFSET / PREVIEW_ZOOM;
    cam.target = [-cam.right[0] * shift, 0.45, -cam.right[2] * shift];

    world.setAmbient(0.5, 0.5, 0.58);
    world.setSun(0.5, 1, 0.4, 0.7, 0.7, 0.75);
    world.add(Model.FLOOR, 0, 0, 0, 0, 1.6, 1, 1.6, 0.3, 0.3, 0.36, 1);
    world.add(Model.FLOOR, 0, 0.005, 0, 0, 1.2, 1, 1.2, 0.42, 0.42, 0.48, 1);
    const c = paletteRGB(this.#race.color);
    const s = this.#race.height;
    const model = this.#gender === 'Female' ? Model.PLAYER_F : Model.PLAYER;
    world.add(model, 0, 0, 0, time * 0.9, s, s, s, c[0], c[1], c[2], 1);
    world.addLight(1.2, 1.6, 1.2, 4, 1, 0.85, 0.6);
  }

  render(screen) {
    screen.clear();
  }

  renderUi(ui) {
    this.#hits = [];
    const p = this.#player;
    drawPanel(ui, CARD_X, CARD_Y, CARD_W, CARD_H);
    ui.uiText(CARD_X + PAD, CARD_Y + 12, t('NEW OATH-HOLDER'), 14, 2);
    ui.uiRect(CARD_X + PAD, CARD_Y + 38, CARD_W - PAD * 2, 1, 0.3, 0.3, 0.35, 1);

    // Name field with a random-name button.
    let y = ROW_Y;
    const focusName = ROWS[this.#row] === 'name';
    ui.uiText(LABEL_X, y + 6, t('NAME'), 8);
    this.#field(ui, CTRL_X, y, VALUE_W + ARROW * 2 + 8, `${p.name}${focusName ? '_' : ''}`, focusName, 'name');
    const rx = CTRL_X + VALUE_W + ARROW * 2 + 16;
    this.#button(ui, rx, y, 76, BTN_H, t('RANDOM'), 'random');

    // Choice rows: < value >.
    const rows = [
      ['gender', t('GENDER'), t(this.#gender)],
      ['race', t('RACE'), t(this.#race.name)],
      ['class', t('CLASS'), t(this.#job.name)],
    ];
    for (const [id, label, value] of rows) {
      y += ROW_H;
      const focused = ROWS[this.#row] === id;
      ui.uiText(LABEL_X, y + 6, label, focused ? 15 : 8);
      this.#button(ui, CTRL_X, y, ARROW, BTN_H, '<', `${id}:-`);
      this.#field(ui, CTRL_X + ARROW + 4, y, VALUE_W, value, focused, id);
      this.#button(ui, CTRL_X + ARROW + VALUE_W + 8, y, ARROW, BTN_H, '>', `${id}:+`);
    }

    // What the hovered or focused row means.
    y += ROW_H + 6;
    const [a, b] = this.#helpLines();
    ui.uiText(LABEL_X, y, a, 7);
    ui.uiText(LABEL_X, y + 10, b, 7);

    // Stats: two columns.
    y += 32;
    ui.uiRect(CARD_X + PAD, y - 6, CARD_W - PAD * 2, 1, 0.2, 0.2, 0.25, 1);
    const race = this.#race;
    const job = this.#job;
    const col2 = CARD_X + 200;
    const stat = (x, yy, label, base, mod) => {
      const end = ui.uiText(x, yy, `${label} §f${base}`, 7);
      if (mod > 0) ui.uiText(end + 8, yy, `+${mod}`, 10);
      if (mod < 0) ui.uiText(end + 8, yy, `${mod}`, 12);
    };
    stat(LABEL_X, y, t('HP').padEnd(3), p.hpMax, race.hp);
    stat(LABEL_X, y + 11, t('STR'), p.str, race.str);
    stat(LABEL_X, y + 22, t('DEX'), p.dex, race.dex);
    stat(LABEL_X, y + 33, t('INT'), p.iq, race.int);
    const mul = (x, yy, label, base, factor) => {
      const end = ui.uiText(x, yy, `${label} §f${(base * factor) | 0}`, 7);
      if (factor !== 1) ui.uiText(end + 8, yy, `x${factor}`, factor > 1 ? 10 : 12);
    };
    const w = Math.max(t('MELEE').length, t('RANGED').length, t('DEF').length, t('SPEED').length);
    mul(col2, y, t('MELEE').padEnd(w), p.str + race.str, job.melee);
    mul(col2, y + 11, t('RANGED').padEnd(w), p.iq + race.int, job.ranged);
    ui.uiText(col2, y + 22, `${t('DEF').padEnd(w)} §f${p.dex + race.dex}`, 7);
    ui.uiText(col2, y + 33, `${t('SPEED').padEnd(w)} §f${((100 + p.dex + race.dex - 11) * race.speed) | 0}`, 7);
    ui.uiText(LABEL_X, y + 48, `${t('MANA')} §f${job.manaMax}   §7${t('WEAPONS')} §f${job.weapons.map(k => t(k)).join(', ')}`, 7);
    const heals = t('HEALS 1 HP EVERY {n}', { n: `§f${tn(race.healInterval, 'turns')}§7` });
    ui.uiText(LABEL_X, y + 59, `${heals}${race.canEat ? '' : `, ${t('CANNOT EAT')}`}`, 7);

    // Buttons.
    const by = CARD_Y + CARD_H - PAD - BTN_H;
    const back = t('BACK');
    const reroll = t('REROLL STATS');
    const begin = t('BEGIN THE DESCENT');
    const bw = s => Renderer.uiTextWidth(s) + 20;
    this.#button(ui, CARD_X + PAD, by, bw(back), BTN_H, back, 'back');
    this.#button(ui, CARD_X + PAD + bw(back) + 10, by, bw(reroll), BTN_H, reroll, 'reroll');
    this.#button(ui, CARD_X + CARD_W - PAD - bw(begin), by, bw(begin), BTN_H, begin, 'begin', true);

    const hint = t('type a name, click the arrows, begin when ready');
    ui.uiText(Config.WIDTH - PAD - Renderer.uiTextWidth(hint), Config.HEIGHT - 14, hint, 8);
  }

  /**
   * A value box; clicking it focuses the row.
   * @param {Renderer} ui @param {number} x @param {number} y @param {number} w
   * @param {string} text @param {boolean} focused @param {string} id
   */
  #field(ui, x, y, w, text, focused, id) {
    ui.uiRect(x, y, w, BTN_H, 0.09, 0.09, 0.12, 1);
    ui.uiFrame(x, y, w, BTN_H, focused ? 0.8 : 0.3, focused ? 0.7 : 0.3, focused ? 0.4 : 0.35, 1);
    ui.uiText(x + ((w - Renderer.uiTextWidth(text)) >> 1), y + 6, text, focused ? 15 : 7);
    this.#hits.push({ id, x, y, w, h: BTN_H });
  }

  /**
   * @param {Renderer} ui @param {number} x @param {number} y @param {number} w @param {number} h
   * @param {string} label @param {string} id @param {boolean} [primary]
   */
  #button(ui, x, y, w, h, label, id, primary = false) {
    drawButton(ui, x, y, w, h, label, this.#hot === id, primary);
    this.#hits.push({ id, x, y, w, h });
  }

  /** @returns {[string, string]} */
  #helpLines() {
    const hot = this.#hot?.split(':')[0] ?? null;
    switch (hot ?? ROWS[this.#row]) {
      case 'name': case 'random': return [t('The name the bell will hear.'), t('Has no effect on the game.')];
      case 'gender': return [t('How you look.'), t('Has no effect on the game.')];
      case 'race': return [t(this.#race.desc[0]), t(this.#race.desc[1])];
      case 'class': return [t(this.#job.desc[0]), t(this.#job.desc[1])];
      case 'reroll': return [t('Roll 3d6 for each stat again.'), t('As often as you like.')];
      case 'begin': return [t('Go down and answer the bell.'), t('Good luck.')];
      case 'back': return [t('Back to the title.'), ''];
      default: return ['', ''];
    }
  }
}

/** Two or three syllables, upper case like a typed name. */
function randomName() {
  const syllables = SYLLABLES[language().id] ?? SYLLABLES.en;
  const n = 2 + globalRng.nextInt(2);
  let name = '';
  for (let i = 0; i < n; i++) name += syllables[globalRng.nextInt(syllables.length)];
  return name.toUpperCase().slice(0, MAX_NAME);
}
