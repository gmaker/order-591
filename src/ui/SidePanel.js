import { Config } from '../config.js';
import { PACK_SIZE, Resource, SLOT_NAMES, Slot } from '../data/items.js';
import { Equipment } from '../game/item/Equipment.js';
import { t, tn } from '../i18n.js';
import { G } from '../gfx/Atlas.js';
import { Renderer } from '../gfx/Renderer.js';

const PANEL_X = Config.WIDTH - Config.PANEL_WIDTH;
const PAD = 8;
const INNER = Config.PANEL_WIDTH - PAD * 2;

const ICON_SCALE = 3;
const ICON = Config.CELL * ICON_SCALE;

/** Gear: 3×3 grid of 40px cells, slot → column, row. */
const GEAR_CELL = 36;
const GEAR_GAP = 4;
const GEAR_Y = 84;
const GEAR_LAYOUT = [
  [Slot.HEAD, 1, 0], [Slot.AMULET, 2, 0],
  [Slot.WEAPON, 0, 1], [Slot.TORSO, 1, 1], [Slot.OFFHAND, 2, 1],
  [Slot.RING, 0, 2], [Slot.LEGS, 1, 2],
];
/** Dim icon shown in an empty slot so its purpose is obvious. */
const SLOT_GLYPH = {
  [Slot.HEAD]: 'HELMET', [Slot.AMULET]: 'AMULET', [Slot.WEAPON]: 'MELEE', [Slot.TORSO]: 'ARMOR',
  [Slot.OFFHAND]: 'SHIELD', [Slot.RING]: 'RING', [Slot.LEGS]: 'PANTS',
};

/** Pack: 4×6 grid of 36px cells. */
const PACK_COLS = 4;
const PACK_ROWS = 6;
const PACK_CELL = 34;
const PACK_GAP = 3;
const PACK_Y = 218;

/** Peddler stock: 4×4 grid on the left of the world view. */
const SHOP_COLS = 4;
const SHOP_ROWS = 4;
const SHOP_X = 12;
const SHOP_Y = 64;
const SHOP_CELL = 40;
const SHOP_GAP = 4;

/** @typedef {{ kind: 'pack'|'gear'|'shop', index: number, slot?: string, x: number, y: number, w: number, h: number, item: import('../game/item/Item.js').Item|null }} Hit */

/**
 * The always-on panel on the right: name and bars, derived stats, gear in
 * its slots and the pack grid. Click pack items to equip, gear to take off,
 * right click to use or drop. When a peddler is open their stock appears
 * on the left and pack clicks sell instead.
 */
export class SidePanel {
  /** @type {import('../game/mob/Player.js').Player} */ #player;
  /** @type {Hit[]} rebuilt every frame */ #hits = [];
  /** @type {Hit|null} */ #hover = null;
  /** @type {{ x: number, y: number } | null} */ #mouse = null;
  /** @type {string|null} short feedback line */ #note = null;
  #noteAge = 0;
  /** @type {import('../game/item/Item.js').Item[]|null} */
  shop = null;

  /** @param {import('../game/mob/Player.js').Player} player */
  constructor(player) {
    this.#player = player;
  }

  /** @param {number} x @param {number} y backbuffer pixels */
  contains(x, y) {
    if (x >= PANEL_X) return true;
    if (this.shop !== null) {
      const w = SHOP_COLS * (SHOP_CELL + SHOP_GAP) + PAD * 2;
      const h = SHOP_ROWS * (SHOP_CELL + SHOP_GAP) + 48;
      if (x >= SHOP_X - PAD && x < SHOP_X - PAD + w && y >= SHOP_Y - 24 && y < SHOP_Y - 24 + h) return true;
    }
    return false;
  }

  // ── Input ────────────────────────────────────────────────────────────────

  /**
   * Handle hover and clicks that land on the panel.
   * @param {import('../core/Input.js').Input} input
   * @param {import('../game/item/Item.js').Item[]} onGround items on the player's cell, for drops
   * @param {(msg: string) => void} log
   */
  update(input, onGround, log) {
    const mouse = input.mouse;
    this.#mouse = mouse;
    this.#hover = mouse === null ? null : this.#hitAt(mouse.x, mouse.y);
    for (const click of input.clicks()) {
      if (!this.contains(click.x, click.y)) continue;
      if (this.#clickButton(click.x, click.y, log)) continue;
      const hit = this.#hitAt(click.x, click.y);
      if (hit === null) continue;
      if (click.button === 0) this.#leftClick(hit, log);
      else if (click.button === 2) this.#rightClick(hit, onGround, log);
    }
  }

  /** @param {number} x @param {number} y @param {(msg: string) => void} log */
  #clickButton(x, y, log) {
    // SORT sits in the pack header.
    if (x >= PANEL_X + Config.PANEL_WIDTH - PAD - 36 && x < PANEL_X + Config.PANEL_WIDTH - PAD && y >= PACK_Y - 16 && y < PACK_Y - 2) {
      this.#player.inventory.sort((a, b) => b.value - a.value);
      this.#say(t('Sorted by worth'));
      return true;
    }
    if (this.shop !== null) {
      const w = SHOP_COLS * (SHOP_CELL + SHOP_GAP) + PAD * 2;
      const bx = SHOP_X - PAD + w - 20;
      if (x >= bx && x < bx + 16 && y >= SHOP_Y - 22 && y < SHOP_Y - 6) {
        this.shop = null;
        log(t('You step away from the peddler'));
        return true;
      }
    }
    return false;
  }

  /** @param {Hit} hit @param {(msg: string) => void} log */
  #leftClick(hit, log) {
    const player = this.#player;
    const item = hit.item;
    if (hit.kind === 'gear') {
      if (hit.slot !== undefined && item !== null) {
        player.unequip(hit.slot);
        this.#say(t('{item} taken off', { item: item.label }));
      }
      return;
    }
    if (item === null) return;
    if (hit.kind === 'shop') {
      if (player.gold < item.buyValue) { this.#say(t('Not enough gold')); return; }
      player.gold -= item.buyValue;
      /** @type {any[]} */ (this.shop).splice(hit.index, 1);
      const sold = player.addItem(item);
      log(t('You buy §f{item}§7 for {price}', { item: item.label, price: tn(item.buyValue, 'gold') }));
      if (sold !== null) log(t('Pack full: §f{item}§7 sold for {price}', { item: sold.label, price: tn(sold.sellValue, 'gold') }));
      return;
    }
    if (this.shop !== null) {
      player.inventory.splice(hit.index, 1);
      player.gold += item.sellValue;
      this.shop.push(item);
      log(t('You sell §f{item}§7 for {price}', { item: item.label, price: tn(item.sellValue, 'gold') }));
      return;
    }
    if (item instanceof Equipment) {
      if (player.equip(item)) this.#say(t('{item} equipped', { item: item.label }));
      else this.#say(t('not for a {job}', { job: t(player.job.name) }));
    } else if (item.isUsable) {
      this.#use(hit.index, item, log);
    }
  }

  /** @param {Hit} hit @param {import('../game/item/Item.js').Item[]} onGround @param {(msg: string) => void} log */
  #rightClick(hit, onGround, log) {
    if (hit.kind !== 'pack' || hit.item === null) return;
    const item = hit.item;
    if (item.isUsable) {
      this.#use(hit.index, item, log);
      return;
    }
    this.#player.inventory.splice(hit.index, 1);
    onGround.push(item);
    log(t('You drop §f{item}', { item: item.label }));
  }

  /** @param {number} index @param {import('../game/item/Item.js').Item} item @param {(msg: string) => void} log */
  #use(index, item, log) {
    if (item.use(this.#player)) {
      this.#player.inventory.splice(index, 1);
      log(t('You use §f{item}', { item: item.label }));
    } else {
      this.#say(t('Cannot use {item} now', { item: item.label }));
    }
  }

  /** @param {string} text */
  #say(text) {
    this.#note = text;
    this.#noteAge = 0;
  }

  /** @param {number} x @param {number} y */
  #hitAt(x, y) {
    for (const h of this.#hits) {
      if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h;
    }
    return null;
  }

  // ── Drawing ──────────────────────────────────────────────────────────────

  /**
   * @param {Renderer} ui
   * @param {import('../core/Input.js').Input} input
   * @param {import('../game/Level.js').Level} level
   * @param {number} dt
   */
  render(ui, input, level, dt) {
    const p = this.#player;
    this.#hits = [];
    this.#noteAge += dt;

    ui.uiRect(PANEL_X, 0, Config.PANEL_WIDTH, Config.HEIGHT, 0.06, 0.06, 0.09, 0.96);
    ui.uiRect(PANEL_X, 0, 1, Config.HEIGHT, 0.4, 0.4, 0.46, 1);

    const x = PANEL_X + PAD;
    ui.uiText(x, 6, p.name, 15);
    const lvl = t('LVL {n}', { n: p.xpLevel });
    ui.uiText(PANEL_X + Config.PANEL_WIDTH - PAD - Renderer.uiTextWidth(lvl), 6, lvl, 7);

    this.#bar(ui, x, 18, p.hp / p.hpMax, [0.75, 0.15, 0.15], `${p.hp}/${p.hpMax}`);
    this.#bar(ui, x, 29, p.mana / p.manaMax, [0.2, 0.35, 0.85], `${p.mana}/${p.manaMax}`);
    this.#bar(ui, x, 40, p.xp / p.xpNext, p.canLevelUp ? [0.85, 0.4, 0.9] : [0.45, 0.3, 0.6], p.canLevelUp ? t('find an altar') : `${p.xp}/${p.xpNext}`);

    ui.uiText(x, 53, t('STR {s}§7  DEX {d}§7  INT {i}', { s: p.getStrString(), d: p.getDexString(), i: p.getIntString() }), 7);
    ui.uiText(x, 62, t('MLE {m}  RNG {r}  DEF {d}', { m: p.getMelee(), r: p.getAtk(), d: p.getDef() }), 7);
    ui.uiText(x, 71, t('SPD {s}  FLOOR §e{f}', { s: p.getSpeed(), f: level.depth }), 7);

    this.#drawGear(ui);
    this.#drawPack(ui);

    const gold = `§e${tn(p.gold, 'gold')}`;
    ui.uiText(x, Config.HEIGHT - 11, gold, 7);
    const weight = `${formatWeight(p.carriedWeight)}/${formatWeight(p.getStr() * 10)}`;
    ui.uiText(PANEL_X + Config.PANEL_WIDTH - PAD - Renderer.uiTextWidth(weight), Config.HEIGHT - 11, weight, p.isOverBurdened() ? 4 : 8);

    if (this.#note !== null && this.#noteAge < 2.5) {
      ui.uiText(x, PACK_Y - 16, this.#note, 8, 1, Math.min(1, 2.5 - this.#noteAge));
    }

    if (this.shop !== null) this.#drawShop(ui);
    if (this.#hover !== null && this.#hover.item !== null) this.#drawTooltip(ui, this.#hover, input);
  }

  /**
   * @param {Renderer} ui @param {number} x @param {number} y @param {number} ratio
   * @param {number[]} color @param {string} label
   */
  #bar(ui, x, y, ratio, color, label) {
    const h = 9;
    ui.uiRect(x, y, INNER, h, 0.12, 0.12, 0.15, 1);
    ui.uiRect(x, y, Math.max(0, Math.min(1, ratio)) * INNER, h, color[0], color[1], color[2], 1);
    ui.uiFrame(x, y, INNER, h, 0.3, 0.3, 0.35, 1);
    ui.uiText(x + ((INNER - Renderer.uiTextWidth(label)) >> 1), y + 1, label, 15);
  }

  /** @param {Renderer} ui */
  #drawGear(ui) {
    const player = this.#player;
    const gridW = 3 * GEAR_CELL + 2 * GEAR_GAP;
    const x0 = PANEL_X + ((Config.PANEL_WIDTH - gridW) >> 1);
    for (const [slot, col, row] of GEAR_LAYOUT) {
      const x = x0 + col * (GEAR_CELL + GEAR_GAP);
      const y = GEAR_Y + row * (GEAR_CELL + GEAR_GAP);
      const item = player.equipment[slot];
      const hovered = this.#hover?.kind === 'gear' && this.#hover.slot === slot;
      this.#drawCell(ui, x, y, GEAR_CELL, item, hovered);
      if (item === null) {
        const g = G[SLOT_GLYPH[slot]];
        ui.uiGlyph(x + ((GEAR_CELL - ICON) >> 1), y + ((GEAR_CELL - ICON) >> 1), g, 8, ICON_SCALE, 0.35);
      } else if (item.resource === Resource.ARROWS) {
        // Arrows left, right on the bow.
        const n = `${player.arrows}`;
        ui.uiText(x + GEAR_CELL - 3 - Renderer.uiTextWidth(n), y + GEAR_CELL - 10, n, player.arrows === 0 ? 4 : 14);
      }
      this.#hits.push({ kind: 'gear', index: 0, slot, x, y, w: GEAR_CELL, h: GEAR_CELL, item });
    }
  }

  /** @param {Renderer} ui */
  #drawPack(ui) {
    const player = this.#player;
    const gridW = PACK_COLS * PACK_CELL + (PACK_COLS - 1) * PACK_GAP;
    const x0 = PANEL_X + ((Config.PANEL_WIDTH - gridW) >> 1);
    ui.uiText(x0, PACK_Y - 14, t('PACK {n}/{max}', { n: player.inventory.length, max: PACK_SIZE }), 14);
    const sortX = PANEL_X + Config.PANEL_WIDTH - PAD - 36;
    const hot = this.#mouseIn(sortX, PACK_Y - 16, 36, 14);
    ui.uiText(sortX + 2, PACK_Y - 14, t('SORT'), hot ? 15 : 8);
    for (let i = 0; i < PACK_COLS * PACK_ROWS; i++) {
      const x = x0 + (i % PACK_COLS) * (PACK_CELL + PACK_GAP);
      const y = PACK_Y + ((i / PACK_COLS) | 0) * (PACK_CELL + PACK_GAP);
      const item = player.inventory[i] ?? null;
      const hovered = this.#hover?.kind === 'pack' && this.#hover.index === i;
      this.#drawCell(ui, x, y, PACK_CELL, item, hovered);
      this.#hits.push({ kind: 'pack', index: i, x, y, w: PACK_CELL, h: PACK_CELL, item });
    }
  }

  /** @param {Renderer} ui */
  #drawShop(ui) {
    const shop = /** @type {import('../game/item/Item.js').Item[]} */ (this.shop);
    const w = SHOP_COLS * (SHOP_CELL + SHOP_GAP) + PAD * 2;
    const h = SHOP_ROWS * (SHOP_CELL + SHOP_GAP) + 48;
    ui.uiRect(SHOP_X - PAD, SHOP_Y - 24, w, h, 0.07, 0.07, 0.1, 0.94);
    ui.uiFrame(SHOP_X - PAD, SHOP_Y - 24, w, h, 0.45, 0.45, 0.5, 1);
    ui.uiText(SHOP_X, SHOP_Y - 18, t('PEDDLER'), 14);
    const bx = SHOP_X - PAD + w - 20;
    ui.uiText(bx + 4, SHOP_Y - 18, 'X', this.#mouseIn(bx, SHOP_Y - 22, 16, 16) ? 15 : 8);
    for (let i = 0; i < SHOP_COLS * SHOP_ROWS; i++) {
      const x = SHOP_X + (i % SHOP_COLS) * (SHOP_CELL + SHOP_GAP);
      const y = SHOP_Y + ((i / SHOP_COLS) | 0) * (SHOP_CELL + SHOP_GAP);
      const item = shop[i] ?? null;
      const hovered = this.#hover?.kind === 'shop' && this.#hover.index === i;
      this.#drawCell(ui, x, y, SHOP_CELL, item, hovered);
      if (item !== null) {
        ui.uiText(x + 2, y + SHOP_CELL - 9, `${item.buyValue}`, this.#player.gold >= item.buyValue ? 14 : 4);
      }
      this.#hits.push({ kind: 'shop', index: i, x, y, w: SHOP_CELL, h: SHOP_CELL, item });
    }
    ui.uiText(SHOP_X, SHOP_Y + SHOP_ROWS * (SHOP_CELL + SHOP_GAP) + 4, t('buy here, sell from the pack'), 8);
  }

  /**
   * @param {Renderer} ui @param {number} x @param {number} y @param {number} size
   * @param {import('../game/item/Item.js').Item|null} item @param {boolean} hovered
   */
  #drawCell(ui, x, y, size, item, hovered) {
    ui.uiRect(x, y, size, size, 0.1, 0.1, 0.13, 1);
    ui.uiFrame(x, y, size, size, hovered ? 1 : 0.3, hovered ? 0.9 : 0.3, hovered ? 0.5 : 0.35, 1);
    if (item === null) return;
    const ix = x + ((size - ICON) >> 1);
    const iy = y + ((size - ICON) >> 1);
    ui.uiGlyph(ix, iy, item.glyph, item.color, ICON_SCALE);
    if (item.textColor !== 7) ui.uiRect(x + size - 6, y + 2, 4, 4, 0.4, 0.9, 1, 1);
  }

  /** @param {number} x @param {number} y @param {number} w @param {number} h */
  #mouseIn(x, y, w, h) {
    const m = this.#mouse;
    return m !== null && m.x >= x && m.x < x + w && m.y >= y && m.y < y + h;
  }

  /**
   * @param {Renderer} ui @param {Hit} hit @param {import('../core/Input.js').Input} input
   */
  #drawTooltip(ui, hit, input) {
    const item = /** @type {import('../game/item/Item.js').Item} */ (hit.item);
    const player = this.#player;
    /** @type {[string, number][]} */
    const lines = [[item.label, item.textColor]];
    if (item instanceof Equipment) {
      lines.push([t(SLOT_NAMES[item.slot]), 8]);
      const worn = hit.kind === 'gear' ? null : player.equipment[item.slot];
      let statLine = `${t(item.stat)} ${item.power}`;
      if (worn !== null) {
        const d = item.power - worn.power;
        statLine += d > 0 ? ` §a+${d}` : d < 0 ? ` §4${d}` : ' §8=';
      }
      lines.push([statLine, 7]);
      if (!player.canUse(item)) lines.push([t('not for a {job}', { job: t(player.job.name) }), 4]);
      if (item.isRanged) lines.push([t('{n} {resource} per shot', { n: item.shotCost, resource: t(item.resource ?? '') }), 7]);
      if (item.spell !== null) {
        lines.push([t(item.spell.name), 13]);
        lines.push([t(item.spell.desc), 9]);
      }
      const text = item.lines;
      for (let i = 1; i < text.length; i++) lines.push([text[i], 9]);
    } else {
      for (const d of item.lines) lines.push([d, 9]);
    }
    const price = hit.kind === 'shop' ? tn(item.buyValue, 'gold') : t('sells for {price}', { price: tn(item.sellValue, 'gold') });
    lines.push([`${formatWeight(item.weight)}  ${price}`, 8]);
    const action = hit.kind === 'gear' ? t('click: take off')
      : hit.kind === 'shop' ? t('click: buy')
        : this.shop !== null ? t('click: sell')
          : item instanceof Equipment ? t('click: equip   right: drop')
            : item.isUsable ? t('click: use   right: drop') : t('right: drop');
    lines.push([action, 3]);

    const width = Math.max(...lines.map(([t]) => Renderer.uiTextWidth(t))) + 12;
    const height = lines.length * 10 + 8;
    const m = input.mouse ?? { x: hit.x, y: hit.y };
    let x = m.x + 14;
    if (x + width > Config.WIDTH - 4) x = m.x - width - 6;
    const y = Math.min(m.y + 14, Config.HEIGHT - height - 4);
    ui.uiRect(x, y, width, height, 0.05, 0.05, 0.08, 0.96);
    ui.uiFrame(x, y, width, height, 0.6, 0.6, 0.65, 1);
    lines.forEach(([text, color], i) => ui.uiText(x + 6, y + 4 + i * 10, text, color));
  }
}

/** @param {number} tenths */
export function formatWeight(tenths) {
  return t('{w}kg', { w: `${(tenths / 10) | 0}.${tenths % 10}` });
}
