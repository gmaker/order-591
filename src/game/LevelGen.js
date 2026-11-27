import { Config } from '../config.js';
import { Rng } from '../core/Rng.js';
import { biomeForDepth } from '../data/biomes.js';
import { Ammo } from './item/Ammo.js';
import { Key } from './item/Key.js';
import { MoneyBag } from './item/MoneyBag.js';
import { Level } from './Level.js';
import { Pos } from './Pos.js';
import { Tiles } from './tile/Tiles.js';

/** Thrown when a floor turns out unusable; generation retries with a new fork. */
class GenError extends Error {}

/**
 * Floor generator.
 *
 * Rooms are rectangles snapped to a 4-cell grid; a new room is accepted only
 * if it overlaps existing floor by 2..4 cells, which guarantees connectivity
 * without a separate corridor pass (three in four "rooms" are 1-wide strips,
 * which is where the corridors come from). Doors go wherever the wall
 * pattern allows one, stairs go to the most distant pair of wall niches, and
 * chests and stations sit in alcoves.
 */
export class LevelGen {
  /** @type {Level} */ #level;
  /** @type {Rng} */ #rng;
  #storesLeft = 0;
  #stationsLeft = 0;

  /**
   * Build a floor, retrying until the result is sane.
   * @param {import('./Level.js').LevelHost} host
   * @param {number} depth 1-based
   * @param {number} runSeed
   */
  static generate(host, depth, runSeed) {
    const size = 19 + depth * 4;
    const seedRng = new Rng(Rng.hash(runSeed, depth));
    for (let attempt = 0; attempt < 100; attempt++) {
      const level = new Level(host, size, size, depth, seedRng.fork());
      level.biome = biomeForDepth(depth);
      try {
        new LevelGen(level).build();
        if (depth > 1 && level.findStairs(-1) === null) throw new GenError('no way back');
        return level;
      } catch (e) {
        if (!(e instanceof GenError)) throw e;
      }
    }
    throw new Error(`Could not generate floor ${depth}`);
  }

  /** @param {Level} level */
  constructor(level) {
    this.#level = level;
    this.#rng = level.rng;
  }

  build() {
    const level = this.#level;
    const w = level.width;
    const h = level.height;
    const depth = level.depth;
    const area = w * h;

    for (let i = 0; i < area; i++) this.#addRoom(i > 0);
    for (let i = 0; i < (area / 10) | 0; i++) this.#addDoor();

    const [start, end] = this.#distantPair();
    if (depth > 1) {
      level.setTile(start.x, start.y, Tiles.stairsPrev);
    } else {
      level.setTile(start.x, start.y, Tiles.floor);
      level.spawnPos = start;
    }
    level.setTile(end.x, end.y, depth < Config.FLOORS ? Tiles.stairsNext : Tiles.beacon);

    for (let i = 0; i < (area / 100) | 0; i++) this.#addChest();
    if (level.biome.trees > 0) this.#addTrees(level.biome.trees);

    this.#storesLeft = (area / 500) | 0;
    this.#stationsLeft = (area / 500) | 0;
    for (let i = 0; i < area * 50; i++) {
      if (this.#storesLeft === 0 && this.#stationsLeft === 0) break;
      this.#addStation();
    }

    this.#scatterItems();
    this.#stockStore();
  }

  // ── Layout ───────────────────────────────────────────────────────────────

  /** @param {boolean} check require a 2..4 cell overlap with existing floor */
  #addRoom(check) {
    const level = this.#level;
    const rng = this.#rng;
    let w = rng.nextInt(12) + 4;
    let h = rng.nextInt(12) + 4;
    if (rng.nextInt(4) > 0) {
      w = rng.nextInt(4) + 4;
      h = rng.nextInt(4) + 4;
      if (rng.nextBool()) w = 1;
      else h = 1;
    }
    w = ((w / 4) | 0) * 4 + 1;
    h = ((h / 4) | 0) * 4 + 1;
    let x = rng.nextInt(level.width - w - 2) + 1;
    let y = rng.nextInt(level.height - h - 2) + 1;
    x = ((x / 4) | 0) * 4 + 1;
    y = ((y / 4) | 0) * 4 + 1;

    if (check) {
      let overlap = 0;
      for (let xx = x - 1; xx < x + w + 1; xx++) {
        for (let yy = y - 1; yy < y + h + 1; yy++) {
          if (level.getTile(xx, yy) === Tiles.floor) overlap++;
        }
      }
      if (overlap < 2 || overlap > 4) return;
    }
    for (let xx = x; xx < x + w; xx++) {
      for (let yy = y; yy < y + h; yy++) level.setTile(xx, yy, Tiles.floor);
    }
  }

  #addDoor() {
    const level = this.#level;
    const rng = this.#rng;
    const x = rng.nextInt(level.width - 2) + 1;
    const y = rng.nextInt(level.height - 2) + 1;
    const u = level.isWall(x, y - 1);
    const d = level.isWall(x, y + 1);
    const l = level.isWall(x - 1, y);
    const r = level.isWall(x + 1, y);
    if (!(u === d && l === r && u !== r)) return;

    let corners = 0;
    if (level.isSolid(x - 1, y - 1)) corners++;
    if (level.isSolid(x + 1, y - 1)) corners++;
    if (level.isSolid(x + 1, y + 1)) corners++;
    if (level.isSolid(x - 1, y + 1)) corners++;
    if (corners === 4) return;

    if (level.depth > 1 && rng.nextInt(3) === 0) {
      const lock = rng.nextInt(3);
      level.setTile(x, y, Tiles.lockedDoors[lock]);
    } else {
      level.setTile(x, y, Tiles.door);
    }
  }

  /**
   * Cell against a straight wall: exactly one orthogonal wall neighbour and
   * two diagonal ones.
   * @param {number} x @param {number} y
   */
  #isNiche(x, y) {
    const level = this.#level;
    let walls = 0;
    if (level.isWall(x, y - 1)) walls++;
    if (level.isWall(x, y + 1)) walls++;
    if (level.isWall(x - 1, y)) walls++;
    if (level.isWall(x + 1, y)) walls++;
    let corners = 0;
    if (level.isWall(x - 1, y - 1)) corners++;
    if (level.isWall(x + 1, y - 1)) corners++;
    if (level.isWall(x + 1, y + 1)) corners++;
    if (level.isWall(x - 1, y + 1)) corners++;
    return walls === 1 && corners === 2;
  }

  /** @returns {Pos} */
  #randomNiche() {
    const level = this.#level;
    const rng = this.#rng;
    for (let i = 0; i < 10000; i++) {
      const x = rng.nextInt(level.width - 2) + 1;
      const y = rng.nextInt(level.height - 2) + 1;
      if (this.#isNiche(x, y)) return new Pos(x, y);
    }
    throw new GenError('no wall niche found');
  }

  /** Best of ten random niche pairs by distance. @returns {[Pos, Pos]} */
  #distantPair() {
    let best = /** @type {[Pos, Pos]|null} */ (null);
    let bestDist = -1;
    for (let i = 0; i < 10; i++) {
      const a = this.#randomNiche();
      const b = this.#randomNiche();
      const dist = a.distanceTo(b);
      if (dist >= bestDist) { best = [a, b]; bestDist = dist; }
    }
    return /** @type {[Pos, Pos]} */ (best);
  }

  #addChest() {
    const level = this.#level;
    const rng = this.#rng;
    const x = rng.nextInt(level.width - 2) + 1;
    const y = rng.nextInt(level.height - 2) + 1;
    if (level.getTile(x, y) !== Tiles.floor) return;
    if (!this.#isNiche(x, y)) return;
    if (rng.nextInt(20) === 0) level.setTile(x, y, Tiles.largeChest);
    else if (rng.nextInt(5) === 0) level.setTile(x, y, Tiles.mediumChest);
    else level.setTile(x, y, Tiles.smallChest);
  }

  /**
   * Trees only grow in the open, where all eight neighbours are walkable,
   * so they never block a corridor.
   * @param {number} chance per floor cell
   */
  #addTrees(chance) {
    const level = this.#level;
    const rng = this.#rng;
    const tries = (level.width * level.height * chance * 3) | 0;
    for (let i = 0; i < tries; i++) {
      const x = rng.nextInt(level.width - 2) + 1;
      const y = rng.nextInt(level.height - 2) + 1;
      if (level.getTile(x, y) !== Tiles.floor) continue;
      let open = true;
      for (let yy = y - 1; yy <= y + 1 && open; yy++) {
        for (let xx = x - 1; xx <= x + 1; xx++) if (level.isSolid(xx, yy)) { open = false; break; }
      }
      if (open) level.setTile(x, y, Tiles.tree);
    }
  }

  /** A wall cell with three wall neighbours and floor on the fourth side. */
  #addStation() {
    const level = this.#level;
    const rng = this.#rng;
    const x = rng.nextInt(level.width - 2) + 1;
    const y = rng.nextInt(level.height - 2) + 1;
    if (level.getTile(x, y) !== Tiles.wall) return;
    let walls = 0;
    if (level.getTile(x, y - 1) === Tiles.wall) walls++;
    if (level.getTile(x, y + 1) === Tiles.wall) walls++;
    if (level.getTile(x - 1, y) === Tiles.wall) walls++;
    if (level.getTile(x + 1, y) === Tiles.wall) walls++;
    let free = 0;
    if (level.getTile(x, y - 1) === Tiles.floor) free++;
    if (level.getTile(x, y + 1) === Tiles.floor) free++;
    if (level.getTile(x - 1, y) === Tiles.floor) free++;
    if (level.getTile(x + 1, y) === Tiles.floor) free++;
    if (walls !== 3 || free !== 1) return;
    if (rng.nextInt(2) === 0 && this.#storesLeft > 0) {
      this.#storesLeft--;
      level.setTile(x, y, Tiles.store);
    } else if (this.#stationsLeft > 0) {
      this.#stationsLeft--;
      level.setTile(x, y, Tiles.levelUp);
    }
  }

  // ── Contents ─────────────────────────────────────────────────────────────

  /** Small clusters of loot around random points. */
  #scatterItems() {
    const level = this.#level;
    const rng = this.#rng;
    const clusters = ((level.width * level.height) / 200) | 0;
    const half = (level.maxValue / 2) | 0;
    for (let j = 0; j < clusters; j++) {
      const xo = rng.nextInt(level.width);
      const yo = rng.nextInt(level.height);
      const count = rng.nextInt(9) + 1;
      for (let k = 0; k < count; k++) {
        const x = xo + rng.nextInt(4) - rng.nextInt(4);
        const y = yo + rng.nextInt(4) - rng.nextInt(4);
        if (level.getTile(x, y) !== Tiles.floor) continue;
        const item = level.spawnItem(rng.nextInt(half) + half);
        if (item !== null) level.addItem(item, x, y);
      }
    }
  }

  /** Stores sell gear a tier above the floor, best items first. */
  #stockStore() {
    const level = this.#level;
    const rng = this.#rng;
    const stock = [];
    for (let j = 0; j < 200; j++) {
      const item = level.spawnItem(level.maxValue * 2);
      if (item === null) continue;
      if (item instanceof MoneyBag || item instanceof Ammo || item instanceof Key) continue;
      stock.push(item);
    }
    stock.sort((a, b) => b.buyValue - a.buyValue);
    stock.length = Math.min(stock.length, rng.nextInt(30) + 10);
    level.storeItems = stock;
  }
}
