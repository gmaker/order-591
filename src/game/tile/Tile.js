import { G } from '../../gfx/Atlas.js';

/**
 * A kind of map cell. Tiles are stateless singletons (see Tiles.js); anything
 * that changes, such as a door opening, is done by swapping the cell to a
 * different tile.
 */
export class Tile {
  /** Blocks movement and light. */
  isSolid = true;
  /** Counts as wall for wall-piece drawing and door placement. */
  isWall = false;
  glyph = G.SPACE;
  color = 15;

  // ── Fluent configuration ─────────────────────────────────────────────────

  /** @param {boolean} v */
  solid(v) { this.isSolid = v; return this; }
  /** @param {boolean} v */
  wall(v) { this.isWall = v; return this; }
  /** @param {number} g */
  withGlyph(g) { this.glyph = g; return this; }
  /** @param {number} c */
  withColor(c) { this.color = c; return this; }

  // ── Behaviour ────────────────────────────────────────────────────────────

  /**
   * @param {import('../Level.js').Level} level @param {number} x @param {number} y
   */
  glyphAt(level, x, y) { return this.glyph; }

  /**
   * @param {import('../Level.js').Level} level @param {number} x @param {number} y
   */
  colorAt(level, x, y) { return this.color; }

  /**
   * A mob tries to step onto this cell.
   * @param {import('../Level.js').Level} level
   * @param {number} x @param {number} y
   * @param {import('../mob/Mob.js').Mob} mob
   * @returns {boolean} whether the mob may enter
   */
  tryMove(level, x, y, mob) { return !this.isSolid; }

  /**
   * The player asked to close things around them.
   * @param {import('../Level.js').Level} level @param {number} x @param {number} y
   */
  close(level, x, y) {}
}
