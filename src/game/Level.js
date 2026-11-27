import { Config } from '../config.js';
import { BIOMES } from '../data/biomes.js';
import { G } from '../gfx/Atlas.js';
import { DARK, FOG } from '../gfx/Palette.js';
import { t, tn } from '../i18n.js';
import { Ammo } from './item/Ammo.js';
import { ItemSpawner } from './item/ItemSpawner.js';
import { MoneyBag } from './item/MoneyBag.js';
import { EnemySpawner } from './mob/EnemyTemplate.js';
import { Pos } from './Pos.js';
import { StairsTile, Tiles } from './tile/Tiles.js';

/**
 * What a level needs from the scene that owns it.
 * @typedef {object} LevelHost
 * @property {(msg: string) => void} addMessage
 * @property {(scene: import('../scenes/Scene.js').Scene) => void} pushScene
 * @property {(depth: number, dir: number) => void} travelToFloor
 * @property {() => void} winGame
 * @property {(type: string, data: object) => void} [onEvent] attack/hit/miss/death/pickup for effects
 * @property {(items: import('./item/Item.js').Item[]) => void} [openShop] the player walked into a peddler
 */

/** Visibility states per cell. */
const UNSEEN = 0;
const REMEMBERED = 1;
const VISIBLE = 2;

/**
 * One floor: tiles, mobs, items, visibility and the action scheduler.
 * Generation lives in LevelGen; this class only knows how to hold and
 * simulate a floor.
 */
export class Level {
  #width;
  #height;
  #depth;
  /** @type {import('../core/Rng.js').Rng} */ #rng;
  /** @type {LevelHost} */ #host;

  /** @type {import('./tile/Tile.js').Tile[]} */ #tiles;
  /** @type {(import('./tile/Tile.js').Tile|null)[]} one-shot overlays (bullet traces) */ #effects;
  /** @type {Uint8Array} */ #seen;
  /** @type {(import('./mob/Mob.js').Mob|null)[]} */ #tileMobs;
  /** @type {import('./item/Item.js').Item[][]} */ #tileItems;
  /** @type {import('./mob/Mob.js').Mob[]} */ #mobs = [];

  /** @type {ItemSpawner} */ #itemSpawner;
  /** @type {EnemySpawner} */ #enemySpawner;
  #maxMobs = 0;
  #currentMoveTime = 0;

  /** @type {import('./mob/Player.js').Player|null} */
  player = null;
  /** Where the player starts on floor 1. @type {Pos|null} */
  spawnPos = null;
  /** Stock shared by every store on this floor. @type {import('./item/Item.js').Item[]} */
  storeItems = [];
  /** Looks and dressing, set by the generator. @type {import('../data/biomes.js').BiomeDef} */
  biome = BIOMES[0];

  /**
   * @param {LevelHost} host
   * @param {number} width @param {number} height
   * @param {number} depth 1-based floor number
   * @param {import('../core/Rng.js').Rng} rng
   */
  constructor(host, width, height, depth, rng) {
    this.#host = host;
    this.#width = width;
    this.#height = height;
    this.#depth = depth;
    this.#rng = rng;
    this.#itemSpawner = new ItemSpawner(rng);
    this.#enemySpawner = new EnemySpawner(rng);

    const n = width * height;
    this.#tiles = new Array(n).fill(Tiles.wall);
    this.#effects = new Array(n).fill(null);
    this.#seen = new Uint8Array(n);
    this.#tileMobs = new Array(n).fill(null);
    this.#tileItems = Array.from({ length: n }, () => []);
    this.#maxMobs = (n / 50) | 0;
  }

  // ── Basics ───────────────────────────────────────────────────────────────

  get width() { return this.#width; }
  get height() { return this.#height; }
  get depth() { return this.#depth; }
  get rng() { return this.#rng; }
  get mobCount() { return this.#mobs.length; }

  /** Loot budget: the single number everything on a floor scales from. */
  get maxValue() { return this.#depth * this.#depth + this.#depth * 8; }

  /** @param {number} x @param {number} y */
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.#width && y < this.#height; }

  /** @param {number} x @param {number} y */
  getTile(x, y) {
    if (!this.inBounds(x, y)) return Tiles.wall;
    return this.#tiles[x + y * this.#width];
  }

  /** @param {number} x @param {number} y @param {import('./tile/Tile.js').Tile} tile */
  setTile(x, y, tile) {
    if (!this.inBounds(x, y)) return;
    this.#tiles[x + y * this.#width] = tile;
  }

  /** @param {number} x @param {number} y */
  isSolid(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.#tiles[x + y * this.#width].isSolid;
  }

  /** @param {number} x @param {number} y */
  isWall(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.#tiles[x + y * this.#width].isWall;
  }

  /** Walkable and unoccupied. */
  isFree(x, y) {
    if (!this.inBounds(x, y)) return false;
    return !this.isSolid(x, y) && this.#tileMobs[x + y * this.#width] === null;
  }

  isSeen(x, y) { return this.inBounds(x, y) && this.#seen[x + y * this.#width] > UNSEEN; }
  isVisible(x, y) { return this.inBounds(x, y) && this.#seen[x + y * this.#width] === VISIBLE; }

  /** @param {number} x @param {number} y */
  getMob(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.#tileMobs[x + y * this.#width];
  }

  /** @param {number} x @param {number} y */
  getItems(x, y) { return this.#tileItems[x + y * this.#width]; }

  /** @param {import('./item/Item.js').Item} item @param {number} x @param {number} y */
  addItem(item, x, y) { this.#tileItems[x + y * this.#width].push(item); }

  /** @param {import('./item/Item.js').Item} item @param {number} x @param {number} y */
  removeItem(item, x, y) {
    const list = this.#tileItems[x + y * this.#width];
    const i = list.indexOf(item);
    if (i >= 0) list.splice(i, 1);
  }

  /** @returns {Pos} */
  getRandomFreePos() {
    for (let i = 0; i < 10000; i++) {
      const x = this.#rng.nextInt(this.#width);
      const y = this.#rng.nextInt(this.#height);
      if (this.isFree(x, y)) return new Pos(x, y);
    }
    throw new Error('No free position found');
  }

  /** @param {number} dir @returns {Pos|null} */
  findStairs(dir) {
    for (let i = 0; i < this.#tiles.length; i++) {
      const tile = this.#tiles[i];
      if (tile instanceof StairsTile && tile.dir === dir) {
        return new Pos(i % this.#width, (i / this.#width) | 0);
      }
    }
    return null;
  }

  // ── Mobs ─────────────────────────────────────────────────────────────────

  /** @param {import('./mob/Mob.js').Mob} mob */
  addMob(mob) {
    if (this.#mobs.includes(mob)) return;
    const i = mob.x + mob.y * this.#width;
    if (this.#tileMobs[i] !== null) throw new Error(`Cell ${mob.x},${mob.y} already has a mob`);
    mob.level = this;
    mob.nextMoveTime = this.#currentMoveTime + 1 / mob.getSpeed();
    this.#mobs.push(mob);
    this.#tileMobs[i] = mob;
    if (mob.isPlayer) this.player = /** @type {import('./mob/Player.js').Player} */ (mob);
  }

  /** @param {import('./mob/Mob.js').Mob} mob */
  removeMob(mob) {
    const k = this.#mobs.indexOf(mob);
    if (k >= 0) this.#mobs.splice(k, 1);
    const i = mob.x + mob.y * this.#width;
    if (this.#tileMobs[i] !== mob) throw new Error(`Mob ${mob.name} is not at ${mob.x},${mob.y}`);
    this.#tileMobs[i] = null;
  }

  /**
   * Update the occupancy grid; the mob updates its own x/y afterwards.
   * @param {import('./mob/Mob.js').Mob} mob @param {number} x @param {number} y
   */
  moveMob(mob, x, y) {
    const from = mob.x + mob.y * this.#width;
    const to = x + y * this.#width;
    if (this.#tileMobs[from] !== mob) throw new Error('Mob was not where it said it was');
    if (this.#tileMobs[to] !== null) throw new Error('Target cell is occupied');
    this.#tileMobs[from] = null;
    this.#tileMobs[to] = mob;
  }

  /** Spawn a small group somewhere out of sight, if there is room. */
  #tryAddMob() {
    const rng = this.#rng;
    const xo = rng.nextInt(this.#width);
    const yo = rng.nextInt(this.#height);
    const count = rng.nextInt(6) + 1;
    for (let i = 0; i < count; i++) {
      const x = xo + rng.nextInt(4) - rng.nextInt(4);
      const y = yo + rng.nextInt(4) - rng.nextInt(4);
      if (this.#mobs.length < this.#maxMobs && this.isFree(x, y) && !this.isVisible(x, y)) {
        this.addMob(this.#enemySpawner.spawn(this.#depth, x, y));
      }
    }
  }

  /**
   * A mob tries to enter a cell: attack whoever is there, or let the tile decide.
   * @param {import('./mob/Mob.js').Mob} mob @param {number} x @param {number} y
   */
  tryMove(mob, x, y) {
    const target = this.getMob(x, y);
    if (target !== null) return target.tryMove(mob);
    if (this.getTile(x, y).tryMove(this, x, y, mob)) {
      if (mob.isPlayer) this.#playerStep(x, y);
      return true;
    }
    return false;
  }

  /** Everything on the cell goes straight into the pack. */
  #playerStep(x, y) {
    const player = /** @type {import('./mob/Player.js').Player} */ (this.player);
    const items = this.#tileItems[x + y * this.#width];
    if (items.length === 0) return;
    let money = 0;
    let ammo = 0;
    const picked = [];
    for (const item of items) {
      if (item instanceof MoneyBag) money += item.value;
      else if (item instanceof Ammo) ammo += item.value;
      else picked.push(item);
    }
    items.length = 0;
    if (money > 0) { this.addMessage(t('You get §e{what}', { what: tn(money, 'gold') })); player.gold += money; }
    if (ammo > 0) { this.addMessage(t('You get §e{what}', { what: tn(ammo, 'arrows') })); player.arrows += ammo; }
    if (picked.length === 1) this.addMessage(t('You pick up §f{item}', { item: picked[0].label }));
    else if (picked.length > 1) this.addMessage(t('You pick up §f{what}', { what: tn(picked.length, 'items') }));
    for (const item of picked) {
      const sold = player.addItem(item);
      if (sold !== null) this.addMessage(t('Pack full: §f{item}§7 sold for {price}', { item: sold.label, price: tn(sold.sellValue, 'gold') }));
    }
    this.emit('pickup', { x, y, money, ammo, items: picked });
  }

  /**
   * Notify the host about something worth a sound or a particle burst.
   * @param {string} type @param {object} data
   */
  emit(type, data) {
    this.#host.onEvent?.(type, data);
  }

  /**
   * Run every mob whose turn comes before the player's. Energy scheduler:
   * each mob acts when its nextMoveTime is the smallest on the floor.
   */
  tick() {
    this.#tryAddMob();
    const player = this.player;
    if (player === null) return;
    for (let guard = 0; guard < 10000; guard++) {
      if (player.isDead || this.#mobs.length === 0) return;
      this.#mobs.sort((a, b) => a.nextMoveTime - b.nextMoveTime);
      const mob = this.#mobs[0];
      if (mob === player) return;
      mob.tick();
      this.#currentMoveTime = mob.nextMoveTime;
      mob.nextMoveTime += 1 / mob.getSpeed();
    }
    throw new Error('Mob scheduling did not converge');
  }

  // ── Items and loot ───────────────────────────────────────────────────────

  /** @param {number} maxValue */
  spawnItem(maxValue) { return this.#itemSpawner.spawnItem(maxValue); }

  /**
   * Two loot rolls at this floor's budget.
   * @param {number} x @param {number} y
   * @returns {number} items dropped
   */
  dropLoot(x, y) {
    let count = 0;
    for (let i = 0; i < 2; i++) {
      const item = this.#itemSpawner.spawnItem(this.maxValue);
      if (item !== null) { count++; this.addItem(item, x, y); }
    }
    return count;
  }

  // ── Visibility ───────────────────────────────────────────────────────────

  /** Demote everything visible to remembered. */
  resetLights() {
    for (let i = 0; i < this.#seen.length; i++) if (this.#seen[i] === VISIBLE) this.#seen[i] = REMEMBERED;
  }

  /**
   * Cast rays to the edge of a square of radius r; cells along each ray and
   * their neighbours become visible until the ray hits something solid.
   * @param {number} xp @param {number} yp @param {number} r
   */
  lightup(xp, yp, r = Config.LIGHT_RADIUS) {
    for (let x = xp - r; x <= xp + r; x++) {
      this.#lightRay(xp, yp, x, yp - r, r);
      this.#lightRay(xp, yp, x, yp + r, r);
    }
    for (let y = yp - r; y <= yp + r; y++) {
      this.#lightRay(xp, yp, xp - r, y, r);
      this.#lightRay(xp, yp, xp + r, y, r);
    }
  }

  #lightRay(x0, y0, x1, y1, r) {
    const xd = x1 - x0;
    const yd = y1 - y0;
    const dist = Math.sqrt(xd * xd + yd * yd) / r;
    const steps = (r / dist) | 0;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (((x1 - x0) * i) / r | 0);
      const y = y0 + (((y1 - y0) * i) / r | 0);
      if (this.isSolid(x, y)) return;
      const xa = x - x0;
      const ya = y - y0;
      for (let xx = -1; xx <= 1; xx++) {
        if ((xx === -1 && xa > 0) || (xx === 1 && xa < 0)) continue;
        for (let yy = -1; yy <= 1; yy++) {
          if ((yy === -1 && ya > 0) || (yy === 1 && ya < 0)) continue;
          this.#light(x + xx, y + yy);
        }
      }
    }
  }

  #light(x, y) {
    if (!this.inBounds(x, y)) return;
    this.#seen[x + y * this.#width] = VISIBLE;
  }

  // ── Effects ──────────────────────────────────────────────────────────────

  /** @param {number} x @param {number} y @param {import('./tile/Tile.js').Tile} tile */
  setEffect(x, y, tile) {
    if (!this.inBounds(x, y)) return;
    this.#effects[x + y * this.#width] = tile;
  }

  clearEffects() { this.#effects.fill(null); }

  // ── Drawing ──────────────────────────────────────────────────────────────

  /**
   * Draw the viewport [x0,x1)×[y0,y1) of the screen centred on (cx, cy).
   * @param {import('../gfx/Screen.js').Screen} screen
   * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
   * @param {number} cx @param {number} cy
   */
  display(screen, x0, y0, x1, y1, cx, cy) {
    const w = this.#width;
    const h = this.#height;
    let xo = cx - ((x1 - x0) >> 1);
    let yo = cy - ((y1 - y0) >> 1);
    if (xo > w - x1 - x0) xo = w - x1 - x0;
    if (yo > h - y1 - y0) yo = h - y1 - y0;
    if (xo < 0) xo = 0;
    if (yo < 0) yo = 0;
    xo -= x0;
    yo -= y0;

    for (let x = x0 + xo; x < x1 + xo; x++) {
      for (let y = y0 + yo; y < y1 + yo; y++) {
        if (x >= w || y >= h) continue;
        const i = x + y * w;
        const seen = this.#seen[i];
        if (seen === UNSEEN) {
          screen.set(x - xo, y - yo, G.NOISE + (i % G.NOISE_COUNT), FOG);
          continue;
        }
        const dark = seen === REMEMBERED ? DARK : 0;
        const tile = this.#tiles[i];
        let glyph = tile.glyphAt(this, x, y);
        let color = tile.colorAt(this, x, y);
        const effect = this.#effects[i];
        const mob = this.#tileMobs[i];
        const items = this.#tileItems[i];
        if (seen === VISIBLE && effect !== null) {
          glyph = effect.glyphAt(this, x, y);
          color = effect.colorAt(this, x, y);
        } else if (seen === VISIBLE && mob !== null) {
          glyph = mob.glyph;
          color = mob.color;
        } else if (items.length > 0) {
          const top = items[items.length - 1];
          glyph = top.glyph;
          color = top.color;
        }
        screen.set(x - xo, y - yo, glyph, color + dark);
      }
    }
  }

  // ── Host callbacks ───────────────────────────────────────────────────────

  /** @param {string} msg */
  addMessage(msg) { this.#host.addMessage(msg); }

  /** @param {import('../scenes/Scene.js').Scene} scene */
  pushScene(scene) { this.#host.pushScene(scene); }

  /** @param {number} dir */
  travelStairs(dir) { this.#host.travelToFloor(this.#depth + dir, dir); }

  winGame() { this.#host.winGame(); }

  /** @param {import('./item/Item.js').Item[]} items */
  openShop(items) { this.#host.openShop?.(items); }
}
