import { G, WALL_DOWN, WALL_LEFT, WALL_RIGHT, WALL_UP } from '../../gfx/Atlas.js';
import { t, tn } from '../../i18n.js';
import { LevelUpScene } from '../../scenes/LevelUpScene.js';
import { LockColor, lockColorIndex, lockName } from '../item/Key.js';
import { Tile } from './Tile.js';

// ── Wall ───────────────────────────────────────────────────────────────────

/**
 * Drawn as box-drawing pieces. A wall connects to a neighbouring wall only if
 * that neighbour borders open space (or is a door/station), so solid rock
 * between rooms stays blank instead of turning into a grid of crosses.
 */
export class WallTile extends Tile {
  constructor() {
    super();
    this.isWall = true;
  }

  /** @param {import('../Level.js').Level} level @param {number} x @param {number} y */
  glyphAt(level, x, y) {
    if (!this.#isEdge(level, x, y)) return G.SPACE;
    let mask = 0;
    if (this.#connects(level, x, y - 1)) mask |= WALL_UP;
    if (this.#connects(level, x, y + 1)) mask |= WALL_DOWN;
    if (this.#connects(level, x - 1, y)) mask |= WALL_LEFT;
    if (this.#connects(level, x + 1, y)) mask |= WALL_RIGHT;
    return G.WALL + mask;
  }

  /** @param {import('../Level.js').Level} level @param {number} x @param {number} y */
  #connects(level, x, y) {
    if (!level.isWall(x, y)) return false;
    if (!(level.getTile(x, y) instanceof WallTile)) return true;
    return this.#isEdge(level, x, y);
  }

  /** True if any of the 8 neighbours inside the map is not a wall. */
  #isEdge(level, x, y) {
    for (let yy = y - 1; yy <= y + 1; yy++) {
      for (let xx = x - 1; xx <= x + 1; xx++) {
        if (xx === x && yy === y) continue;
        if (!level.inBounds(xx, yy)) continue;
        if (!level.isWall(xx, yy)) return true;
      }
    }
    return false;
  }
}

// ── Door ───────────────────────────────────────────────────────────────────

export class DoorTile extends Tile {
  /**
   * @param {boolean} locked
   * @param {number} lockColor one of LockColor
   * @param {boolean} open
   */
  constructor(locked, lockColor, open) {
    super();
    this.locked = locked;
    this.lockColor = lockColor;
    this.isWall = true;
    this.isSolid = !open;
  }

  get isOpen() { return !this.isSolid; }

  /** @param {import('../Level.js').Level} level @param {number} x @param {number} y */
  glyphAt(level, x, y) {
    const horizontal = level.isWall(x + 1, y) || level.isWall(x - 1, y);
    if (horizontal) return this.isOpen ? G.DOOR_H_OPEN : G.DOOR_H;
    return this.isOpen ? G.DOOR_V_OPEN : G.DOOR_V;
  }

  tryMove(level, x, y, mob) {
    if (this.isOpen) return true;
    if (!mob.isPlayer) return false;
    const player = /** @type {import('../mob/Player.js').Player} */ (mob);
    if (this.locked) {
      const key = player.getKey(this.lockColor);
      if (key === null) {
        level.addMessage(t(`You need a ${lockName(this.lockColor)} key`));
      } else {
        player.inventory.splice(player.inventory.indexOf(key), 1);
        level.setTile(x, y, Tiles.openDoor);
        level.addMessage(t(`The ${lockName(this.lockColor)} key turns and crumbles`));
      }
    } else {
      level.setTile(x, y, Tiles.openDoor);
      level.addMessage(t('You open the door'));
    }
    return false;
  }

  close(level, x, y) {
    if (this.isOpen && level.isFree(x, y) && level.getItems(x, y).length === 0) {
      level.setTile(x, y, Tiles.door);
      level.addMessage(t('You close the door'));
    }
  }
}

// ── Stairs, chests, beacon ─────────────────────────────────────────────────

export class StairsTile extends Tile {
  /** @param {number} dir +1 deeper, -1 back up */
  constructor(dir) {
    super();
    this.dir = dir;
    this.isSolid = false;
  }

  tryMove(level, x, y, mob) {
    if (mob.isPlayer) level.travelStairs(this.dir);
    return false;
  }
}

const CHEST_NAMES = ['small', 'large', 'huge'];

export class ChestTile extends Tile {
  /** @param {number} size 1..3; loot rolls = 2^size */
  constructor(size) {
    super();
    this.size = size;
    this.isSolid = false;
  }

  tryMove(level, x, y, mob) {
    if (!mob.isPlayer) return false;
    level.setTile(x, y, Tiles.floor);
    let count = 0;
    for (let i = 0; i < 1 << this.size; i++) count += level.dropLoot(x, y);
    const size = t(`chest.${CHEST_NAMES[this.size - 1]}`);
    level.addMessage(count === 0
      ? t('The {size} chest is empty', { size })
      : t('The {size} chest contains {what}', { size, what: tn(count, 'items') }));
    return false;
  }
}

export class BeaconTile extends Tile {
  constructor() {
    super();
    this.isSolid = false;
  }

  tryMove(level, x, y, mob) {
    if (mob.isPlayer) level.winGame();
    return false;
  }
}

/** A tree: blocks movement and sight but is not a wall, so walls do not join it. */
export class TreeTile extends Tile {
  constructor() {
    super();
    this.isSolid = true;
    this.isWall = false;
  }
}

// ── Wall-mounted stations ──────────────────────────────────────────────────

/** A machine set into a wall; the player walks into it to use it. */
export class StationTile extends Tile {
  constructor() {
    super();
    this.isWall = true;
    this.glyph = G.STATION;
  }
}

export class StoreTile extends StationTile {
  tryMove(level, x, y, mob) {
    if (mob.isPlayer) level.openShop(level.storeItems);
    return false;
  }
}

export class LevelUpTile extends StationTile {
  tryMove(level, x, y, mob) {
    if (!mob.isPlayer) return false;
    const player = /** @type {import('../mob/Player.js').Player} */ (mob);
    if (player.canLevelUp) {
      const msg = player.levelUp();
      level.pushScene(new LevelUpScene(player, msg));
    } else {
      level.addMessage(t('The altar stays silent. Not yet.'));
    }
    return false;
  }
}

// ── Singletons ─────────────────────────────────────────────────────────────

export const Tiles = Object.freeze({
  floor: new Tile().solid(false),
  wall: new WallTile(),

  door: new DoorTile(false, 0, false).withColor(7),
  openDoor: new DoorTile(false, 0, true).withColor(7),
  /** Locked doors indexed by LockColor. */
  lockedDoors: [LockColor.BRONZE, LockColor.SILVER, LockColor.GOLD].map(
    lock => new DoorTile(true, lock, false).withColor(lockColorIndex(lock)),
  ),

  blood: new Tile().solid(false).withGlyph(G.BLOOD).withColor(4),
  tree: new TreeTile().withColor(2),
  smallChest: new ChestTile(1).withGlyph(G.CHEST).withColor(4),
  mediumChest: new ChestTile(2).withGlyph(G.CHEST).withColor(12),
  largeChest: new ChestTile(3).withGlyph(G.CHEST).withColor(14),

  store: new StoreTile().withColor(14),
  levelUp: new LevelUpTile().withColor(13),

  stairsNext: new StairsTile(1).withGlyph(G.STAIRS_DOWN).withColor(11),
  stairsPrev: new StairsTile(-1).withGlyph(G.STAIRS_UP).withColor(11),
  beacon: new BeaconTile().withGlyph(G.BEACON).withColor(13),

  bullet: new Tile().withGlyph(G.BULLET).withColor(14),
  bulletHit: new Tile().withGlyph(G.BULLET_HIT).withColor(14),
  bulletMiss: new Tile().withGlyph(G.BULLET_HIT).withColor(12),
});
