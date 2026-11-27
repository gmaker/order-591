import { Config } from '../config.js';
import { Noise } from '../core/Noise.js';
import { FG } from '../gfx/Palette.js';
import { GRASS_VARIANTS, Model } from '../gfx3d/Models.js';
import {
  BeaconTile, ChestTile, DoorTile, StairsTile, StationTile, StoreTile, Tiles, TreeTile, WallTile,
} from './tile/Tiles.js';

/** Cells drawn around the camera target in each direction. */
const VIEW_RADIUS = 18;
/** Opacity of walls that stand between the camera and the player. */
const FADE_ALPHA = 0.3;
/** Neighbour offsets and the yaw that points a WALL_ARM at them. */
const WALL_ARMS = [
  [1, 0, 0], [-1, 0, Math.PI], [0, 1, -Math.PI / 2], [0, -1, Math.PI / 2],
];
const LABEL_LIFE = 1.1;
/** Cells per second a flying arrow or spell covers. */
const PROJECTILE_SPEED = 20;
/** Seconds a lightning bolt stays on screen. */
const BOLT_LIFE = 0.3;
/** Cells per noise feature: lower is broader meadows. */
const GRASS_NOISE_SCALE = 0.13;
/** Events that wait for the projectile that caused them to land. */
const DEFERRED = new Set(['hit', 'miss', 'death', 'freeze']);

/**
 * Per-mob animation state. The simulation moves mobs a whole cell at a time;
 * the view eases a visual position toward it and adds lunges and flashes.
 * @typedef {object} VisualMob
 * @property {number} x @property {number} z
 * @property {number} yaw
 * @property {number} lungeX @property {number} lungeZ
 * @property {number} flash
 * @property {number} lastX @property {number} lastY
 */

/** @typedef {{ x: number, y: number, text: string, color: number, alpha: number }} ScreenLabel */

/**
 * A shot in flight. The simulation already resolved it; the view carries the
 * resulting hit/death events in `deferred` and replays them on arrival.
 * @typedef {object} Projectile
 * @property {number} sx @property {number} sz start
 * @property {number} tx @property {number} tz end
 * @property {number} x @property {number} y @property {number} z current
 * @property {number} t 0..1 along the way
 * @property {number} dist cells
 * @property {number} yaw
 * @property {string} kind arrow, orb or shard
 * @property {number[]} color rgb
 * @property {boolean} blocked ends in a wall
 * @property {boolean} hitsMob
 * @property {{ type: string, data: any }[]} deferred
 */

/** @typedef {{ ax: number, az: number, bx: number, bz: number, color: number[], life: number }} Bolt */
/** @typedef {{ x: number, y: number, z: number, radius: number, color: number[], life: number, maxLife: number }} Flash */

/**
 * Turns a Level into a 3D frame: tiles, items, mobs, lights, particles and
 * the camera, dressed by the level's biome. Also owns the small amount of
 * animation state the simulation does not care about: eased positions,
 * lunges, hit flashes, camera shake and floating damage numbers.
 */
export class WorldView {
  /** @type {import('../gfx3d/SceneRenderer.js').SceneRenderer} */ #world;
  /** @type {Map<import('./mob/Mob.js').Mob, VisualMob>} */ #visuals = new Map();
  #camX = 0;
  #camZ = 0;
  #camInit = false;
  #shake = 0;
  /** @type {{ wx: number, wy: number, wz: number, text: string, color: number, life: number }[]} */
  #floating = [];
  /** @type {Projectile[]} */ #projectiles = [];
  /** The shot whose hits are waiting for it to land. @type {Projectile|null} */ #inflight = null;
  /** @type {Bolt[]} */ #bolts = [];
  /** @type {Flash[]} */ #flashes = [];
  /** Dead mobs still drawn until the shot that killed them lands. @type {Set<import('./mob/Mob.js').Mob>} */
  #ghosts = new Set();
  /** Where grass grows and how tall, per floor. @type {Noise|null} */ #noise = null;
  #noiseDepth = 0;

  /** @type {{ x: number, y: number } | null} */ hover = null;
  /** @type {{ x: number, y: number }[]} */ path = [];
  /** Floating texts in backbuffer pixels, valid after build(). @type {ScreenLabel[]} */
  labels = [];

  /** @param {import('../gfx3d/SceneRenderer.js').SceneRenderer} world */
  constructor(world) {
    this.#world = world;
  }

  get camera() { return this.#world.camera; }

  /** Forget animation state (new floor). */
  reset() {
    this.#visuals.clear();
    this.#floating.length = 0;
    this.#projectiles.length = 0;
    this.#bolts.length = 0;
    this.#flashes.length = 0;
    this.#ghosts.clear();
    this.#inflight = null;
    this.#camInit = false;
  }

  /**
   * Visual position of a mob (for effects), falling back to its cell.
   * @param {import('./mob/Mob.js').Mob} mob
   */
  positionOf(mob) {
    const v = this.#visuals.get(mob);
    return v ? { x: v.x + v.lungeX, z: v.z + v.lungeZ } : { x: mob.x, z: mob.y };
  }

  // ── Events from the simulation ───────────────────────────────────────────

  /**
   * @param {string} type
   * @param {any} data
   */
  onEvent(type, data) {
    const particles = this.#world.particles;
    if (this.#inflight !== null && DEFERRED.has(type)) {
      this.#inflight.deferred.push({ type, data });
      if (type === 'death') this.#ghosts.add(data.mob);
      return;
    }
    switch (type) {
      case 'shot':
        this.#startShot(data);
        break;
      case 'shotDone':
        this.#inflight = null;
        break;
      case 'chain':
        this.#addBolt(data.from.x, data.from.y, data.to.x, data.to.y, data.color);
        break;
      case 'freeze': {
        const p = this.positionOf(data.target);
        particles.burst(p.x, 0.5, p.z, 14, { r: 0.7, g: 0.9, b: 1, speed: 1.5, size: 0.1, life: 0.7, up: 1.5, gravity: 3 });
        this.#floating.push({ wx: p.x, wy: 1.1, wz: p.z, text: 'frozen', color: 11, life: LABEL_LIFE });
        break;
      }
      case 'attack': {
        const v = this.#visual(data.source);
        v.lungeX = (data.target.x - data.source.x) * 0.35;
        v.lungeZ = (data.target.y - data.source.y) * 0.35;
        v.yaw = Math.atan2(-(data.target.y - data.source.y), data.target.x - data.source.x);
        break;
      }
      case 'hit': {
        const v = this.#visual(data.target);
        v.flash = 1;
        const p = this.positionOf(data.target);
        const n = Math.min(14, 3 + data.damage);
        particles.burst(p.x, 0.5, p.z, n, { r: 0.9, g: 0.15, b: 0.1, speed: 2.5, size: 0.1, life: 0.5 });
        const onPlayer = data.target.isPlayer;
        this.#floating.push({ wx: p.x, wy: 0.9, wz: p.z, text: `-${data.damage}`, color: onPlayer ? 12 : 14, life: LABEL_LIFE });
        if (onPlayer) this.#shake = Math.min(1, 0.25 + data.damage * 0.03);
        break;
      }
      case 'miss': {
        const p = this.positionOf(data.target);
        particles.burst(p.x, 0.6, p.z, 3, { r: 0.7, g: 0.7, b: 0.7, speed: 1, size: 0.08, life: 0.3, up: 1 });
        this.#floating.push({ wx: p.x, wy: 0.9, wz: p.z, text: 'miss', color: 8, life: LABEL_LIFE * 0.8 });
        break;
      }
      case 'death': {
        const p = this.positionOf(data.mob);
        const c = paletteRGB(data.mob.color);
        particles.burst(p.x, 0.4, p.z, 24, { r: c[0], g: c[1], b: c[2], speed: 3, size: 0.14, life: 0.8 });
        particles.burst(p.x, 0.3, p.z, 10, { r: 0.6, g: 0.1, b: 0.1, speed: 2, size: 0.1, life: 0.6 });
        this.#visuals.delete(data.mob);
        this.#ghosts.delete(data.mob);
        this.#shake = Math.max(this.#shake, 0.18);
        break;
      }
      case 'pickup': {
        const n = 6 + data.items.length * 3 + (data.money > 0 ? 6 : 0) + (data.ammo > 0 ? 3 : 0);
        particles.burst(data.x, 0.3, data.y, n, { r: 1, g: 0.9, b: 0.4, speed: 1.2, size: 0.08, life: 0.7, up: 2.5, gravity: 1 });
        if (data.money > 0) this.#floating.push({ wx: data.x, wy: 0.7, wz: data.y, text: `+${data.money}`, color: 14, life: LABEL_LIFE });
        break;
      }
      default:
        break;
    }
  }

  // ── Frame ────────────────────────────────────────────────────────────────

  /**
   * @param {import('./Level.js').Level} level
   * @param {import('./mob/Player.js').Player} player
   * @param {number} dt seconds
   * @param {number} time seconds
   * @param {number} centerOffsetPx how far right of the screen centre the player sits
   */
  build(level, player, dt, time, centerOffsetPx) {
    const world = this.#world;
    const biome = level.biome;
    world.begin();
    world.setAmbient(biome.ambient[0], biome.ambient[1], biome.ambient[2]);
    world.setSun(0.4, 1, 0.3, biome.sun[0], biome.sun[1], biome.sun[2]);

    this.#animate(level, player, dt);
    const pv = this.positionOf(player);
    this.#followCamera(pv.x, pv.z, dt, centerOffsetPx);
    // Player light first so it is never dropped by the light cap.
    world.addLight(pv.x, 0.9, pv.z, 7, biome.torch[0], biome.torch[1], biome.torch[2]);

    const cx = Math.round(this.#camX);
    const cz = Math.round(this.#camZ);
    const x0 = Math.max(0, cx - VIEW_RADIUS);
    const x1 = Math.min(level.width - 1, cx + VIEW_RADIUS);
    const y0 = Math.max(0, cz - VIEW_RADIUS);
    const y1 = Math.min(level.height - 1, cz + VIEW_RADIUS);
    const depth = level.depth;
    const remembered = biome.remembered;
    if (this.#noise === null || this.#noiseDepth !== depth) {
      this.#noise = new Noise(depth * 7919 + 591);
      this.#noiseDepth = depth;
    }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!level.isSeen(x, y)) continue;
        const visible = level.isVisible(x, y);
        const bright = visible ? 1 : remembered;
        const tile = level.getTile(x, y);
        const h = hash(x, y, depth);
        const near = Math.abs(x - player.x) + Math.abs(y - player.y) <= 7;

        // Things standing between the camera and the player are dithered away.
        const alpha = occludesPlayer(player, x, y) ? FADE_ALPHA : 1;

        if (tile instanceof WallTile) {
          if (!isEdgeWall(level, x, y)) continue;
          const shade = 0.92 + (h % 7) * 0.02;
          const r = biome.wall[0] * shade, g = biome.wall[1] * shade, b = biome.wall[2] * shade;
          world.add(Model.WALL, x, 0, y, 0, 1, 1, 1, r, g, b, bright, 0, 0, 0, alpha);
          for (const [dx, dy, yaw] of WALL_ARMS) {
            if (connectsWall(level, x + dx, y + dy)) {
              world.add(Model.WALL_ARM, x, 0, y, yaw, 1, 1, 1, r, g, b, bright, 0, 0, 0, alpha);
            }
          }
          continue;
        }

        // Floor under everything else, with a little per-cell variation.
        const f = 0.9 + ((h >> 3) % 5) * 0.05;
        world.add(Model.FLOOR, x, 0, y, 0, 1, 1, 1, biome.floor[0] * f, biome.floor[1] * f, biome.floor[2] * f, bright);

        if (tile instanceof TreeTile) {
          const g = 0.8 + (h % 5) * 0.08;
          const s = 0.85 + ((h >> 4) % 4) * 0.1;
          world.add(Model.TREE, x, 0, y, (h % 6), s, s, s, 0.32 * g, 0.55 * g, 0.3 * g, bright, 0, 0.5, 0, alpha);
        } else if (tile instanceof DoorTile) {
          const horizontal = level.isWall(x + 1, y) || level.isWall(x - 1, y);
          const c = paletteRGB(tile.color);
          world.add(tile.isOpen ? Model.DOOR_OPEN : Model.DOOR_CLOSED, x, 0, y, horizontal ? 0 : Math.PI / 2,
            1, 1, 1, c[0], c[1], c[2], bright, 0, 0, 0, alpha);
        } else if (tile instanceof StairsTile) {
          world.add(tile.dir > 0 ? Model.STAIRS_DOWN : Model.STAIRS_UP, x, 0, y, 0, 1, 1, 1, 0.75, 0.78, 0.85, bright);
        } else if (tile instanceof ChestTile) {
          const s = 0.75 + tile.size * 0.2;
          world.add(Model.CHEST, x, 0, y, 0, s, s, s, 1, 1, 1, bright);
        } else if (tile instanceof BeaconTile) {
          world.add(Model.BEACON, x, 0, y, time * 0.5, 1, 1, 1, 0.6, 0.9, 1, bright, 0.8 + Math.sin(time * 4) * 0.3);
          if (visible) world.addLight(x, 1.3, y, 6, 0.4, 0.8, 1);
        } else if (tile instanceof StationTile) {
          const store = tile instanceof StoreTile;
          const c = store ? [1, 0.85, 0.3] : [1, 0.5, 0.9];
          world.add(Model.STATION, x, 0, y, facingYaw(level, x, y), 1, 1, 1, c[0], c[1], c[2], bright, 0.35, 0, 0, alpha);
          if (visible && near) world.addLight(x, 0.8, y, 3.5, c[0] * 0.6, c[1] * 0.6, c[2] * 0.6);
        } else if (tile === Tiles.blood) {
          world.add(Model.BLOOD, x, 0, y, (h % 4) * Math.PI / 2, 1, 1, 1, 1, 1, 1, bright);
        } else if (tile === Tiles.floor) {
          this.#dressFloor(biome, x, y, h, bright, visible && near);
        }

        const items = level.getItems(x, y);
        if (items.length > 0) {
          const item = items[items.length - 1];
          const c = paletteRGB(item.color);
          world.add(Model.ITEM, x, 0.12 + Math.sin(time * 3 + x + y) * 0.05, y, time * 1.5, 1, 1, 1, c[0], c[1], c[2], bright, 0.25);
        }

        if (visible) {
          const mob = level.getMob(x, y);
          if (mob !== null) this.#drawMob(mob, player, bright);
        }
      }
    }

    for (const ghost of this.#ghosts) {
      if (ghost.level === level && level.isVisible(ghost.x, ghost.y)) this.#drawMob(ghost, player, 1);
    }
    this.#drawEffects(time);

    // Hover marker and the planned path.
    if (this.hover !== null && level.isSeen(this.hover.x, this.hover.y)) {
      world.add(Model.FLOOR, this.hover.x, 0.015, this.hover.y, 0, 0.9, 1, 0.9, 1, 0.95, 0.5, 1, 0.5);
    }
    for (const step of this.path) {
      world.add(Model.FLOOR, step.x, 0.012, step.y, 0, 0.25, 1, 0.25, 1, 0.95, 0.5, 1, 0.4);
    }

    this.#updateEffects(dt);
    world.particles.update(dt);
    this.#updateLabels(dt);
  }

  // ── Shots ────────────────────────────────────────────────────────────────

  /** @param {any} data the 'shot' event */
  #startShot(data) {
    const start = this.positionOf(data.source);
    let ex = data.to.x;
    let ez = data.to.y;
    if (data.target !== null) {
      const tp = this.positionOf(data.target);
      ex = tp.x;
      ez = tp.z;
    }
    let dx = ex - start.x;
    let dz = ez - start.z;
    let len = Math.hypot(dx, dz) || 1;
    if (data.target === null && data.blocked) {
      // Stop at the near face of the wall, not inside it.
      ex -= (dx / len) * 0.45;
      ez -= (dz / len) * 0.45;
      dx = ex - start.x;
      dz = ez - start.z;
      len = Math.hypot(dx, dz) || 1;
    }
    const color = data.color ?? [1, 1, 1];
    if (data.kind === 'chain') {
      this.#addBolt(start.x, start.z, ex, ez, color);
      if (data.target !== null) this.#shake = Math.max(this.#shake, 0.12);
      return;
    }
    const sx = start.x + (dx / len) * 0.3;
    const sz = start.z + (dz / len) * 0.3;
    /** @type {Projectile} */
    const p = {
      sx, sz, tx: ex, tz: ez, x: sx, y: 0.55, z: sz, t: 0,
      dist: Math.hypot(ex - sx, ez - sz), yaw: Math.atan2(-dz, dx),
      kind: data.kind, color, blocked: data.blocked, hitsMob: data.target !== null, deferred: [],
    };
    this.#projectiles.push(p);
    this.#inflight = p;
    if (p.kind !== 'arrow') {
      this.#world.particles.burst(sx, 0.6, sz, 6, { r: color[0], g: color[1], b: color[2], speed: 1, size: 0.08, life: 0.3, up: 0.5, gravity: 0 });
    }
  }

  /**
   * @param {number} ax @param {number} az @param {number} bx @param {number} bz
   * @param {number[]} color
   */
  #addBolt(ax, az, bx, bz, color) {
    this.#bolts.push({ ax, az, bx, bz, color, life: BOLT_LIFE });
    this.#world.particles.burst(bx, 0.6, bz, 10, { r: color[0], g: color[1], b: color[2], speed: 2, size: 0.08, life: 0.35, up: 1, gravity: 2 });
    this.#flashes.push({ x: bx, y: 0.7, z: bz, radius: 3.5, color, life: 0.2, maxLife: 0.2 });
  }

  /** Fly projectiles, age bolts and flashes. @param {number} dt */
  #updateEffects(dt) {
    for (let i = this.#projectiles.length - 1; i >= 0; i--) {
      const p = this.#projectiles[i];
      p.t += (dt * PROJECTILE_SPEED) / Math.max(0.5, p.dist);
      if (p.t >= 1) {
        this.#projectiles.splice(i, 1);
        this.#land(p);
        continue;
      }
      p.x = p.sx + (p.tx - p.sx) * p.t;
      p.z = p.sz + (p.tz - p.sz) * p.t;
      p.y = 0.55 + (p.kind === 'arrow'
        ? Math.sin(p.t * Math.PI) * Math.min(0.35, p.dist * 0.05)
        : Math.sin(p.t * 20) * 0.02);
      this.#trail(p, dt);
    }
    for (let i = this.#bolts.length - 1; i >= 0; i--) {
      if ((this.#bolts[i].life -= dt) <= 0) this.#bolts.splice(i, 1);
    }
    for (let i = this.#flashes.length - 1; i >= 0; i--) {
      if ((this.#flashes[i].life -= dt) <= 0) this.#flashes.splice(i, 1);
    }
  }

  /** @param {Projectile} p @param {number} dt */
  #trail(p, dt) {
    if (p.kind === 'arrow') return;
    const particles = this.#world.particles;
    const c = p.color;
    const orb = p.kind === 'orb';
    const n = Math.ceil(dt * (orb ? 90 : 50));
    for (let i = 0; i < n; i++) {
      particles.spawn({
        x: p.x + (Math.random() - 0.5) * 0.15, y: p.y + (Math.random() - 0.5) * 0.15, z: p.z + (Math.random() - 0.5) * 0.15,
        vx: (Math.random() - 0.5) * 0.6, vy: orb ? 0.8 : -0.2, vz: (Math.random() - 0.5) * 0.6,
        life: orb ? 0.4 : 0.5, size: orb ? 0.13 : 0.08,
        r: orb ? c[0] : 0.85, g: orb ? c[1] * 0.8 : 0.95, b: orb ? c[2] * 0.5 : 1,
        gravity: orb ? -1.5 : 3,
      });
    }
  }

  /** The projectile reached its end: impact effects, then the hits it carried. @param {Projectile} p */
  #land(p) {
    const particles = this.#world.particles;
    const c = p.color;
    if (p.kind === 'arrow') {
      if (p.blocked) particles.burst(p.tx, p.y, p.tz, 6, { r: 0.7, g: 0.7, b: 0.6, speed: 1.5, size: 0.06, life: 0.3, up: 1 });
      else if (!p.hitsMob) particles.burst(p.tx, 0.1, p.tz, 4, { r: 0.5, g: 0.45, b: 0.35, speed: 0.8, size: 0.06, life: 0.3, up: 0.5 });
    } else if (p.kind === 'orb') {
      particles.burst(p.tx, p.y, p.tz, 26, { r: c[0], g: c[1], b: c[2], speed: 3, size: 0.14, life: 0.6, up: 1.5, gravity: 2 });
      particles.burst(p.tx, p.y, p.tz, 10, { r: 1, g: 1, b: 0.8, speed: 1, size: 0.2, life: 0.25, up: 0.5, gravity: 0 });
      this.#flashes.push({ x: p.tx, y: 0.6, z: p.tz, radius: 5, color: c, life: 0.3, maxLife: 0.3 });
      this.#shake = Math.max(this.#shake, 0.15);
    } else {
      particles.burst(p.tx, p.y, p.tz, 16, { r: 0.8, g: 0.95, b: 1, speed: 2.5, size: 0.1, life: 0.5, up: 1.5, gravity: 5 });
      this.#flashes.push({ x: p.tx, y: 0.6, z: p.tz, radius: 3, color: c, life: 0.2, maxLife: 0.2 });
    }
    // Now the hits land. A newer shot may be in flight; its hits stay its own.
    const saved = this.#inflight;
    this.#inflight = null;
    for (const e of p.deferred) this.onEvent(e.type, e.data);
    this.#inflight = saved === p ? null : saved;
  }

  /** Projectiles, lightning and light flashes. @param {number} time */
  #drawEffects(time) {
    const world = this.#world;
    for (const p of this.#projectiles) {
      const c = p.color;
      if (p.kind === 'arrow') {
        world.add(Model.ARROW, p.x, p.y, p.z, p.yaw, 1, 1, 1, 1, 1, 1, 1);
      } else if (p.kind === 'orb') {
        const s = 1 + Math.sin(time * 30) * 0.12;
        world.add(Model.ORB, p.x, p.y, p.z, time * 7, s, s, s, c[0], c[1], c[2], 0.6, 0.6);
        world.addLight(p.x, p.y, p.z, 4, c[0], c[1], c[2]);
      } else {
        world.add(Model.SHARD, p.x, p.y, p.z, p.yaw, 1, 1, 1, c[0], c[1], c[2], 1, 0.7);
        world.addLight(p.x, p.y, p.z, 2.5, c[0] * 0.7, c[1] * 0.7, c[2] * 0.7);
      }
    }
    for (const b of this.#bolts) {
      const k = b.life / BOLT_LIFE;
      const dx = b.bx - b.ax;
      const dz = b.bz - b.az;
      const len = Math.hypot(dx, dz) || 1;
      const n = Math.max(2, Math.round(len * 2));
      let px = b.ax;
      let pz = b.az;
      // Fresh jitter every frame makes the bolt flicker.
      for (let i = 1; i <= n; i++) {
        const f = i / n;
        const jitter = i === n ? 0 : 0.22;
        const nx = b.ax + dx * f + (-dz / len) * (Math.random() - 0.5) * jitter * 2;
        const nz = b.az + dz * f + (dx / len) * (Math.random() - 0.5) * jitter * 2;
        const segLen = Math.hypot(nx - px, nz - pz);
        const yaw = Math.atan2(-(nz - pz), nx - px);
        world.add(Model.BOLT, px, 0.55 + (Math.random() - 0.5) * 0.08, pz, yaw, segLen, 0.5 + k, 0.5 + k,
          b.color[0], b.color[1], b.color[2], 1, 1, 0, 0, Math.min(1, k * 1.5 + 0.2));
        px = nx;
        pz = nz;
      }
      world.addLight((b.ax + b.bx) / 2, 0.7, (b.az + b.bz) / 2, 4 * k + 1, b.color[0] * k, b.color[1] * k, b.color[2] * k);
    }
    for (const f of this.#flashes) {
      const k = f.life / f.maxLife;
      world.addLight(f.x, f.y, f.z, f.radius * (0.5 + k * 0.5), f.color[0] * k * 1.5, f.color[1] * k * 1.5, f.color[2] * k * 1.5);
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /**
   * Grass and biome decoration on a plain floor cell. Grass follows a noise
   * field: the biome's `grass` is the share of floor it covers, and inside a
   * meadow the blades grow taller toward the middle, so patches fade into
   * bare ground instead of stopping at a cell edge.
   * @param {import('../data/biomes.js').BiomeDef} biome
   * @param {number} x @param {number} y @param {number} h @param {number} bright @param {boolean} lit
   */
  #dressFloor(biome, x, y, h, bright, lit) {
    const world = this.#world;
    const roll = h % 1000;
    if (biome.grass > 0) {
      const noise = /** @type {Noise} */ (this.#noise);
      const n = noise.at(x * GRASS_NOISE_SCALE, y * GRASS_NOISE_SCALE);
      const threshold = 1 - biome.grass;
      if (n > threshold) {
        const k = (n - threshold) / (1 - threshold);
        const height = 0.45 + k * 1.1 + ((h >> 10) % 5) * 0.04;
        const g = 0.8 + k * 0.3 + ((h >> 14) % 4) * 0.03;
        const gc = biome.grassColor;
        world.add(GRASS_VARIANTS[h % 3], x, 0, y, ((h >> 3) % 4) * (Math.PI / 2),
          1, height, 1, gc[0] * g, gc[1] * g, gc[2] * g, bright, 0, 0.5 + k * 0.7);
        return;
      }
    }
    if (biome.decor === 'none' || roll >= 1000 - biome.decorDensity * 1000) return;
    const yaw = ((h >> 9) % 8) * (Math.PI / 4);
    if (biome.decor === 'bones') {
      world.add(Model.BONES, x, 0, y, yaw, 1, 1, 1, 1, 1, 1, bright);
    } else if (biome.decor === 'mushroom') {
      world.add(Model.MUSHROOM, x, 0, y, yaw, 1, 1, 1, 0.6, 0.9, 0.5, bright, 0.5);
      if (lit) world.addLight(x, 0.3, y, 2, 0.2, 0.5, 0.2);
    } else if (biome.decor === 'crystal') {
      world.add(Model.CRYSTAL, x, 0, y, yaw, 1, 1, 1, 0.75, 0.55, 1, bright, 0.7);
      if (lit) world.addLight(x, 0.4, y, 2.5, 0.45, 0.25, 0.7);
    }
  }

  /** @param {import('./mob/Mob.js').Mob} mob */
  #visual(mob) {
    let v = this.#visuals.get(mob);
    if (v === undefined) {
      v = { x: mob.x, z: mob.y, yaw: 0, lungeX: 0, lungeZ: 0, flash: 0, lastX: mob.x, lastY: mob.y };
      this.#visuals.set(mob, v);
    }
    return v;
  }

  /**
   * Ease every tracked mob toward its cell; drop mobs that are gone.
   * @param {import('./Level.js').Level} level
   * @param {import('./mob/Player.js').Player} player
   * @param {number} dt
   */
  #animate(level, player, dt) {
    this.#visual(player);
    const ease = 1 - Math.exp(-dt * 14);
    const decay = Math.exp(-dt * 9);
    for (const [mob, v] of this.#visuals) {
      if ((mob.isDead && !this.#ghosts.has(mob)) || (mob !== player && mob.level !== level)) { this.#visuals.delete(mob); continue; }
      if (mob.x !== v.lastX || mob.y !== v.lastY) {
        v.yaw = Math.atan2(-(mob.y - v.lastY), mob.x - v.lastX);
        v.lastX = mob.x;
        v.lastY = mob.y;
      }
      v.x += (mob.x - v.x) * ease;
      v.z += (mob.y - v.z) * ease;
      v.lungeX *= decay;
      v.lungeZ *= decay;
      v.flash *= decay;
    }
    this.#shake *= Math.exp(-dt * 7);
  }

  /**
   * @param {import('./mob/Mob.js').Mob} mob
   * @param {import('./mob/Player.js').Player} player
   * @param {number} bright
   */
  #drawMob(mob, player, bright) {
    const v = this.#visual(mob);
    let c = paletteRGB(mob.color);
    let emissive = 0;
    if (mob.frozen > 0) {
      c = [c[0] * 0.4 + 0.35, c[1] * 0.4 + 0.5, c[2] * 0.4 + 0.6];
      emissive = 0.3;
    }
    let model = Model.BLOB + Math.max(0, Math.min(6, mob.kind));
    let scale = 1;
    if (mob === player) {
      model = player.gender === 'Female' ? Model.PLAYER_F : Model.PLAYER;
      scale = player.race.height;
    }
    const bob = Math.abs(v.x - mob.x) + Math.abs(v.z - mob.y) > 0.02 ? 0.06 : 0;
    this.#world.add(model, v.x + v.lungeX, bob, v.z + v.lungeZ, v.yaw, scale, scale, scale, c[0], c[1], c[2], bright, emissive, 0, v.flash * 0.8);
    this.#world.add(Model.FLOOR, v.x + v.lungeX, 0.008, v.z + v.lungeZ, 0, 0.5, 1, 0.5, 0.05, 0.05, 0.07, 1);
  }

  /**
   * @param {number} x @param {number} z @param {number} dt @param {number} offsetPx
   */
  #followCamera(x, z, dt, offsetPx) {
    if (!this.#camInit) { this.#camX = x; this.#camZ = z; this.#camInit = true; }
    const ease = 1 - Math.exp(-dt * 6);
    this.#camX += (x - this.#camX) * ease;
    this.#camZ += (z - this.#camZ) * ease;
    const cam = this.#world.camera;
    const shift = offsetPx / cam.zoom;
    const sx = (Math.random() - 0.5) * this.#shake * 0.5;
    const sz = (Math.random() - 0.5) * this.#shake * 0.5;
    cam.target = [this.#camX + cam.right[0] * shift + sx, 0, this.#camZ + cam.right[2] * shift + sz];
  }

  /** Age floating texts and project the live ones to the screen. */
  #updateLabels(dt) {
    const cam = this.#world.camera;
    this.labels.length = 0;
    for (let i = this.#floating.length - 1; i >= 0; i--) {
      const f = this.#floating[i];
      f.life -= dt;
      if (f.life <= 0) { this.#floating.splice(i, 1); continue; }
      f.wy += dt * 0.9;
      const p = cam.project(f.wx, f.wy, f.wz);
      this.labels.push({
        x: p.x - f.text.length * Config.CELL * 0.5,
        y: p.y,
        text: f.text,
        color: f.color,
        alpha: Math.min(1, f.life * 2.5),
      });
    }
  }
}

/**
 * @param {number} index palette index
 * @returns {number[]} rgb 0..1
 */
export function paletteRGB(index) {
  const i = (index & 15) * 3;
  return [FG[i], FG[i + 1], FG[i + 2]];
}

/** Cheap integer hash for per-cell variation. */
function hash(x, y, d) {
  let h = (x * 374761393 + y * 668265263 + d * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Yaw that turns a model's front (+z) toward the open side of a cell set
 * into a wall, so stations face the room instead of standing sideways.
 * @param {import('./Level.js').Level} level @param {number} x @param {number} y
 */
function facingYaw(level, x, y) {
  let ox = 0;
  let oz = 0;
  for (const [dx, dy] of WALL_ARMS) {
    if (!level.isSolid(x + dx, y + dy)) { ox += dx; oz += dy; }
  }
  if (ox === 0 && oz === 0) return 0;
  return Math.atan2(ox, oz);
}

/**
 * A wall arm reaches toward a neighbour that is a door, a station, or a wall
 * that itself borders open space.
 * @param {import('./Level.js').Level} level @param {number} x @param {number} y
 */
function connectsWall(level, x, y) {
  if (!level.isWall(x, y)) return false;
  if (!(level.getTile(x, y) instanceof WallTile)) return true;
  return isEdgeWall(level, x, y);
}

/**
 * The camera sits toward +x/+z, so cells on that diagonal band in front of
 * the player can hide them.
 * @param {import('./mob/Player.js').Player} player @param {number} x @param {number} y
 */
function occludesPlayer(player, x, y) {
  const dx = x - player.x;
  const dy = y - player.y;
  if (dx < 0 || dy < 0) return false;
  const sum = dx + dy;
  return sum >= 1 && sum <= 7 && Math.abs(dx - dy) <= 1;
}

/**
 * @param {import('./Level.js').Level} level @param {number} x @param {number} y
 */
function isEdgeWall(level, x, y) {
  for (let yy = y - 1; yy <= y + 1; yy++) {
    for (let xx = x - 1; xx <= x + 1; xx++) {
      if (level.inBounds(xx, yy) && !level.isWall(xx, yy)) return true;
    }
  }
  return false;
}
