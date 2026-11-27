/**
 * Base class for everything that owns the screen: title, intro text, the game,
 * inventory overlays. The SceneManager keeps a stack and only the top scene
 * receives update(), renderWorld() and render().
 */
export class Scene {
  /** @type {import('./SceneManager.js').SceneManager} assigned by the manager on push */
  scenes = /** @type {any} */ (null);

  /** Called when the scene is pushed onto the stack. */
  enter() {}

  /** Called when the scene is popped or replaced. */
  exit() {}

  /**
   * One simulation tick.
   * @param {import('../core/Input.js').Input} input
   */
  update(input) {}

  /**
   * Fill the 3D frame. Scenes without a world leave this empty and the
   * screen behind the overlay stays black.
   * @param {import('../gfx3d/SceneRenderer.js').SceneRenderer} world
   * @param {number} dt seconds since the last frame
   * @param {number} time seconds since start
   */
  renderWorld(world, dt, time) {}

  /**
   * Draw into the glyph overlay. The screen is NOT cleared between frames, so
   * a scene that wants a clean slate calls screen.clear() itself.
   * @param {import('../gfx/Screen.js').Screen} screen
   * @param {number} alpha sub-tick interpolation factor [0, 1)
   */
  render(screen, alpha) {}

  /**
   * Draw pixel-space UI (panels, icons, tooltips) on top of the glyph screen.
   * @param {import('../gfx/Renderer.js').Renderer} ui
   * @param {import('../core/Input.js').Input} input for hover positions
   */
  renderUi(ui, input) {}

  /**
   * Whether the overlay covers the whole screen (text scenes) or only the
   * cells that carry glyphs (HUD over the world).
   */
  get opaque() { return true; }

  /** Whether renderWorld() draws anything (so overlays can show the world below). */
  get hasWorld() { return false; }
}
