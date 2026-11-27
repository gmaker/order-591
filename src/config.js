/**
 * Global constants. The backbuffer is WIDTH×HEIGHT logical pixels, shown at
 * an integer SCALE so the low-resolution look is preserved. The 3D scene and
 * the glyph overlay both render at this resolution.
 */
export const Config = Object.freeze({
  WIDTH: 800,
  HEIGHT: 450,
  SCALE: 2,

  /** Glyph cell size in pixels for the text overlay; COLS/ROWS derive from it. */
  CELL: 8,
  COLS: 100,
  ROWS: 56,

  /** Width of the always-on side panel (gear and pack) on the right. */
  PANEL_WIDTH: 200,

  /** Backbuffer pixels per world unit (one grid cell is one unit). */
  ZOOM: 36,

  TICK_RATE: 60,
  /** Max ms simulated per frame after a stall (hidden tab, debugger). */
  MAX_CATCHUP_MS: 200,

  /** Ticks a key must be held before it auto-repeats, and the repeat period. */
  KEY_REPEAT_DELAY: 14,
  KEY_REPEAT_INTERVAL: 4,
  /** Ticks between steps when walking to a clicked cell. */
  WALK_TICKS: 5,

  FLOORS: 16,
  LIGHT_RADIUS: 10,
});
