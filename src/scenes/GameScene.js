import { Config } from '../config.js';
import { Action } from '../core/Input.js';
import { Rng } from '../core/Rng.js';
import { LevelGen } from '../game/LevelGen.js';
import { hates } from '../game/mob/Faction.js';
import { findPath } from '../game/Pathfinder.js';
import { WorldView } from '../game/WorldView.js';
import { pages, t } from '../i18n.js';
import { SidePanel } from '../ui/SidePanel.js';
import { GameOverScene } from './GameOverScene.js';
import { Scene } from './Scene.js';
import { TextScene } from './TextScene.js';
import { TitleScene } from './TitleScene.js';

const LOG_ROWS = 5;
const MAX_MESSAGES = 200;

const SHOT_RANGE = 10;
/** How far chain lightning looks for its next target. */
const CHAIN_REACH = 3;

/** @typedef {{ cells: { x: number, y: number }[], target: import('../game/mob/Mob.js').Mob|null, blocked: boolean }} ShotTrace */

/**
 * The run itself. Owns the player, the floors generated so far, the message
 * log and the side panel; acts as LevelHost for the current floor; and
 * translates mouse clicks into turns (walk a path, attack, open).
 */
export class GameScene extends Scene {
  /** @type {import('../game/mob/Player.js').Player} */ #player;
  /** @type {(import('../game/Level.js').Level|undefined)[]} indexed by depth */ #levels = [];
  /** @type {import('../game/Level.js').Level|null} */ #level = null;
  /** @type {string[]} */ #messages = [];
  #seed;

  /** @type {WorldView|null} created on first renderWorld */ #view = null;
  /** @type {SidePanel} */ #panel;
  /** @type {{ x: number, y: number }[]} */ #path = [];
  #walkTimer = 0;
  #walkFailures = 0;
  #lastDt = 0;

  /**
   * @param {import('../game/mob/Player.js').Player} player
   * @param {number} [seed] run seed; random when omitted
   */
  constructor(player, seed = new Rng().next()) {
    super();
    this.#player = player;
    this.#seed = seed;
    this.#panel = new SidePanel(player);
  }

  get seed() { return this.#seed; }
  get player() { return this.#player; }
  get level() { return this.#level; }
  get hasWorld() { return true; }
  get opaque() { return false; }

  enter() {
    if (this.#level === null) this.travelToFloor(1, 0);
  }

  // ── Input ────────────────────────────────────────────────────────────────

  update(input) {
    const player = this.#player;
    const level = this.#level;
    if (player.isDead || level === null) return;

    if (input.anyKeyPressed) this.#stopWalking();
    if (input.isPressed(Action.CANCEL) && this.#panel.shop !== null) {
      this.#panel.shop = null;
      this.addMessage(t('You step away from the peddler'));
    }

    this.#panel.update(input, level.getItems(player.x, player.y), msg => this.addMessage(msg));

    if (input.isPressed(Action.CLOSE_DOORS)) {
      this.#closeDoors();
      return;
    }

    this.#handleMouse(input);

    const dir = input.direction();
    if (dir !== null) {
      if (input.shift) this.#attemptFire(player.x + dir.x, player.y + dir.y);
      else this.#attemptMove(dir.x, dir.y);
      return;
    }
    if (input.isTriggered(Action.WAIT)) {
      this.#attemptMove(0, 0);
      return;
    }

    this.#walk();
  }

  /** @param {import('../core/Input.js').Input} input */
  #handleMouse(input) {
    const view = this.#view;
    if (view === null) return;
    const mouse = input.mouse;
    view.hover = mouse === null || this.#panel.contains(mouse.x, mouse.y) ? null : this.#cellAt(mouse.x, mouse.y);

    for (const click of input.clicks()) {
      if (this.#panel.contains(click.x, click.y)) continue;
      const cell = this.#cellAt(click.x, click.y);
      if (cell === null) continue;
      if (click.button === 2) {
        if (cell.x !== this.#player.x || cell.y !== this.#player.y) this.#attemptFire(cell.x, cell.y);
        continue;
      }
      if (click.button !== 0) continue;
      this.#clickCell(cell.x, cell.y);
    }
  }

  /**
   * Left click: adjacent cells act at once (attack, open, use); farther
   * cells start a walk along the shortest known path.
   * @param {number} x @param {number} y
   */
  #clickCell(x, y) {
    const player = this.#player;
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    const dx = x - player.x;
    const dy = y - player.y;
    if (dx === 0 && dy === 0) { this.#attemptMove(0, 0); return; }
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) { this.#attemptMove(dx, dy); return; }
    if (!level.isSeen(x, y)) return;

    const path = findPath(level.width, level.height, player.x, player.y, x, y,
      (px, py) => level.isSeen(px, py) && !level.isSolid(px, py) && level.getMob(px, py) === null);
    if (path === null) { this.addMessage(t('§8No way there')); return; }
    this.#path = path;
    this.#walkTimer = 0;
    this.#walkFailures = 0;
    if (this.#view) this.#view.path = path;
  }

  /**
   * One step along the path every few ticks. The walk stops when something
   * blocks the next cell, when we get hurt, or while any enemy is in view:
   * with monsters around, every step is the player's own call.
   */
  #walk() {
    if (this.#path.length === 0) return;
    if (this.#walkTimer-- > 0) return;
    this.#walkTimer = Config.WALK_TICKS;

    const player = this.#player;
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    const next = this.#path[0];
    const dx = next.x - player.x;
    const dy = next.y - player.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) { this.#stopWalking(); return; }
    if (level.getMob(next.x, next.y) !== null) { this.#stopWalking(); return; }

    const hpBefore = player.hp;
    this.#attemptMove(dx, dy);
    if (this.#level !== level) { this.#stopWalking(); return; } // took the stairs

    if (player.x === next.x && player.y === next.y) {
      this.#path.shift();
      this.#walkFailures = 0;
    } else if (++this.#walkFailures >= 2) {
      this.#stopWalking();
      return;
    }
    if (this.#view) this.#view.path = this.#path;

    if (player.hp < hpBefore || this.#enemyInSight()) this.#stopWalking();
  }

  #stopWalking() {
    this.#path = [];
    if (this.#view) this.#view.path = [];
  }

  #enemyInSight() {
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    const p = this.#player;
    const r = Config.LIGHT_RADIUS;
    for (let y = p.y - r; y <= p.y + r; y++) {
      for (let x = p.x - r; x <= p.x + r; x++) {
        if (!level.isVisible(x, y)) continue;
        const mob = level.getMob(x, y);
        if (mob !== null && hates(mob.faction, p.faction)) return true;
      }
    }
    return false;
  }

  /**
   * @param {number} px @param {number} py backbuffer pixels
   * @returns {{ x: number, y: number } | null} grid cell
   */
  #cellAt(px, py) {
    const view = this.#view;
    const level = this.#level;
    if (view === null || level === null) return null;
    const floor = this.#pick(px, py, 0);
    if (floor !== null && level.getMob(floor.x, floor.y) !== null) return floor;
    // A click on a mob's body lands behind its feet; try at body height too.
    const body = this.#pick(px, py, 0.45);
    if (body !== null && level.isVisible(body.x, body.y) && level.getMob(body.x, body.y) !== null) return body;
    return floor;
  }

  /** @param {number} px @param {number} py @param {number} height */
  #pick(px, py, height) {
    const view = /** @type {WorldView} */ (this.#view);
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    const hit = view.camera.pickGround(px, py, height);
    if (hit === null) return null;
    const x = Math.round(hit.x);
    const y = Math.round(hit.z);
    return level.inBounds(x, y) ? { x, y } : null;
  }

  #closeDoors() {
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    const p = this.#player;
    for (let x = p.x - 1; x <= p.x + 1; x++) {
      for (let y = p.y - 1; y <= p.y + 1; y++) level.getTile(x, y).close(level, x, y);
    }
    this.#relight();
  }

  /** @param {number} xa @param {number} ya */
  #attemptMove(xa, ya) {
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    const player = this.#player;
    level.clearEffects();
    // Moving away ends trading; walking into the peddler reopens it below.
    if (xa !== 0 || ya !== 0) this.#panel.shop = null;
    if (player.isOverBurdened()) {
      this.addMessage(t("§8You're overburdened and can't move!"));
    } else {
      player.attemptMove(xa, ya);
    }
    // Stairs may have swapped the level under us; act on the current one.
    const current = /** @type {import('../game/Level.js').Level} */ (this.#level);
    player.tick();
    player.nextMoveTime += 1 / player.getSpeed();
    this.#tickWorld(current);
    this.#relight();
  }

  /**
   * Shoot toward a cell with the equipped bow or staff. The shot resolves at
   * once, then the world gets the turn it costs.
   * @param {number} tx @param {number} ty
   */
  #attemptFire(tx, ty) {
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    const player = this.#player;
    level.clearEffects();
    const check = player.canShoot();
    if (!check.ok) {
      this.addMessage(`§4${t(check.reason ?? '')}`);
      return;
    }
    const weapon = /** @type {import('../game/item/Equipment.js').Equipment} */ (player.rangedWeapon);
    player.spendShot();
    const shot = this.#traceShot(tx, ty);
    if (shot !== null) this.#resolveShot(shot, weapon);
    // The shot is ours; then the world gets its turn.
    player.nextMoveTime += 1 / player.getSpeed();
    this.#tickWorld(level);
    this.#relight();
  }

  /**
   * Straight line from the player through (tx, ty), up to SHOT_RANGE cells,
   * stopping at the first wall or mob.
   * @param {number} tx @param {number} ty
   * @returns {ShotTrace|null}
   */
  #traceShot(tx, ty) {
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    const player = this.#player;
    const dx = tx - player.x;
    const dy = ty - player.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return null;
    /** @type {{ x: number, y: number }[]} */
    const cells = [];
    for (let i = 1; i <= SHOT_RANGE; i++) {
      const x = player.x + Math.round((dx * i) / steps);
      const y = player.y + Math.round((dy * i) / steps);
      if (!level.inBounds(x, y)) break;
      cells.push({ x, y });
      if (level.isSolid(x, y)) return { cells, target: null, blocked: true };
      const mob = level.getMob(x, y);
      if (mob !== null && mob !== player) return { cells, target: mob, blocked: false };
    }
    return { cells, target: null, blocked: false };
  }

  /**
   * Apply a traced shot: damage, splash, freeze or chain hops, with events
   * for the view to animate.
   * @param {ShotTrace} shot
   * @param {import('../game/item/Equipment.js').Equipment} weapon
   */
  #resolveShot(shot, weapon) {
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    const player = this.#player;
    const spell = weapon.spell;
    const target = shot.target;
    const end = shot.cells[shot.cells.length - 1];
    level.emit('shot', {
      source: player, to: end, target, blocked: shot.blocked,
      kind: spell === null ? 'arrow' : spell.projectile,
      color: spell === null ? null : spell.color,
    });
    if (target === null) {
      if (shot.blocked) {
        this.addMessage(spell === null
          ? t('§8The arrow clatters off the wall')
          : t('§8The {spell} bursts against the wall', { spell: t(spell.name) }));
      }
    } else if (spell !== null && spell.chain) {
      this.#chainLightning(target, spell);
    } else {
      target.shoot(player);
      if (spell !== null && spell.splash) this.#splash(target, spell.splash);
      if (spell !== null && spell.freeze && !target.isDead && level.rng.nextFloat() < spell.freeze) {
        target.freeze(spell.freezeTurns ?? 2);
      }
    }
    level.emit('shotDone', {});
  }

  /**
   * Part of the damage to every enemy standing next to the target.
   * @param {import('../game/mob/Mob.js').Mob} target @param {number} fraction
   */
  #splash(target, fraction) {
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    const player = this.#player;
    for (let y = target.y - 1; y <= target.y + 1; y++) {
      for (let x = target.x - 1; x <= target.x + 1; x++) {
        const mob = level.getMob(x, y);
        if (mob === null || mob === target || mob === player || !hates(mob.faction, player.faction)) continue;
        mob.shoot(player, fraction);
      }
    }
  }

  /**
   * Hit the first target, then jump to the nearest fresh enemy in reach,
   * weaker with every hop.
   * @param {import('../game/mob/Mob.js').Mob} first
   * @param {import('../data/items.js').SpellDef} spell
   */
  #chainLightning(first, spell) {
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    const player = this.#player;
    const hit = new Set([first]);
    let from = first;
    let scale = 1;
    first.shoot(player);
    for (let hop = 1; hop < (spell.chain ?? 1); hop++) {
      scale *= spell.chainFalloff ?? 0.7;
      let best = null;
      let bestDist = Infinity;
      for (let y = from.y - CHAIN_REACH; y <= from.y + CHAIN_REACH; y++) {
        for (let x = from.x - CHAIN_REACH; x <= from.x + CHAIN_REACH; x++) {
          const mob = level.getMob(x, y);
          if (mob === null || mob === player || hit.has(mob) || !hates(mob.faction, player.faction)) continue;
          if (!level.isVisible(x, y)) continue;
          const d = Math.abs(x - from.x) + Math.abs(y - from.y);
          if (d < bestDist) { bestDist = d; best = mob; }
        }
      }
      if (best === null) break;
      level.emit('chain', { from: { x: from.x, y: from.y }, to: { x: best.x, y: best.y }, color: spell.color });
      hit.add(best);
      best.shoot(player, scale);
      from = best;
    }
  }

  /** @param {import('../game/Level.js').Level} level */
  #tickWorld(level) {
    level.tick();
    if (this.#player.isDead) {
      this.#stopWalking();
      this.scenes.push(new GameOverScene(this));
    }
  }

  #relight() {
    const level = /** @type {import('../game/Level.js').Level} */ (this.#level);
    level.resetLights();
    level.lightup(this.#player.x, this.#player.y, Config.LIGHT_RADIUS);
  }

  // ── LevelHost ────────────────────────────────────────────────────────────

  /** @param {string} msg */
  addMessage(msg) {
    this.#messages.push(msg);
    if (this.#messages.length > MAX_MESSAGES) this.#messages.splice(0, this.#messages.length - MAX_MESSAGES);
  }

  /** @param {Scene} scene */
  pushScene(scene) { this.scenes.push(scene); }

  /**
   * @param {string} type @param {object} data
   */
  onEvent(type, data) {
    this.#view?.onEvent(type, data);
  }

  /** @param {import('../game/item/Item.js').Item[]} items */
  openShop(items) {
    this.#panel.shop = items;
    this.addMessage(t('The peddler spreads out their wares'));
  }

  /**
   * @param {number} depth
   * @param {number} dir +1 going deeper, -1 going back, 0 for the first floor
   */
  travelToFloor(depth, dir) {
    const player = this.#player;
    if (this.#level !== null) this.#level.removeMob(player);

    let level = this.#levels[depth];
    if (level === undefined) {
      level = LevelGen.generate(this, depth, this.#seed);
      this.#levels[depth] = level;
    }
    this.#level = level;

    const pos = dir === 0 ? level.spawnPos : level.findStairs(-dir);
    if (pos === null) throw new Error(`Floor ${depth} has no arrival point`);
    const squatter = level.getMob(pos.x, pos.y);
    if (squatter !== null) squatter.despawn();
    player.setPos(pos);

    this.addMessage(depth === 1
      ? t('You climb down into {biome}', { biome: t(level.biome.name) })
      : t('Floor {n}: {biome}', { n: depth, biome: t(level.biome.name) }));

    level.addMob(player);
    level.resetLights();
    level.lightup(player.x, player.y, Config.LIGHT_RADIUS);
    this.#stopWalking();
    this.#panel.shop = null;
    this.#view?.reset();
  }

  winGame() {
    this.scenes.change(new TextScene(pages('win'), s => s.scenes.change(new TitleScene())));
  }

  // ── Drawing ──────────────────────────────────────────────────────────────

  renderWorld(world, dt, time) {
    if (this.#view === null) this.#view = new WorldView(world);
    if (this.#level === null) return;
    this.#lastDt = dt;
    world.camera.zoom = Config.ZOOM;
    world.camera.yaw = Math.PI / 4;
    this.#view.build(this.#level, this.#player, dt, time, Config.PANEL_WIDTH / 2);
  }

  render(screen) {
    const level = this.#level;
    screen.clear();
    if (level === null) return;

    const hover = this.#view?.hover ?? null;
    if (hover !== null && level.isVisible(hover.x, hover.y)) {
      const mob = level.getMob(hover.x, hover.y);
      if (mob !== null && mob !== this.#player) {
        screen.drawString(t('{name} §c{hp}§7/{max}', { name: mob.getName(), hp: mob.hp, max: mob.hpMax }), 1, screen.rows - LOG_ROWS - 3, 7);
      }
    }

    const first = Math.max(0, this.#messages.length - LOG_ROWS);
    for (let i = first; i < this.#messages.length; i++) {
      screen.drawString(this.#messages[i], 1, screen.rows - LOG_ROWS - 1 + (i - first), 7);
    }
  }

  renderUi(ui, input) {
    const level = this.#level;
    if (level === null) return;
    ui.uiText(6, 6, t('FLOOR §e{n}  §8{biome}', { n: level.depth, biome: t(level.biome.name) }), 7);
    if (this.#view !== null) {
      for (const l of this.#view.labels) ui.uiText(l.x, l.y, l.text, l.color, 1, l.alpha);
    }
    this.#panel.render(ui, input, level, this.#lastDt);
  }
}
