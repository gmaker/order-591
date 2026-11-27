/**
 * Stack of scenes. Transitions apply immediately, which is what a turn-based
 * game wants: a key press can push an overlay and the very next tick belongs
 * to that overlay.
 */
export class SceneManager {
  /** @type {import('./Scene.js').Scene[]} */
  #stack = [];

  get current() { return this.#stack[this.#stack.length - 1] ?? null; }
  get depth() { return this.#stack.length; }

  /**
   * Replace the whole stack with one scene.
   * @param {import('./Scene.js').Scene} scene
   */
  change(scene) {
    while (this.#stack.length) this.#stack.pop()?.exit();
    this.push(scene);
  }

  /** @param {import('./Scene.js').Scene} scene */
  push(scene) {
    scene.scenes = this;
    this.#stack.push(scene);
    scene.enter();
  }

  pop() {
    this.#stack.pop()?.exit();
  }

  /**
   * The scene under the given one, for overlays that draw what they cover.
   * @param {import('./Scene.js').Scene} scene
   * @returns {import('./Scene.js').Scene|null}
   */
  below(scene) {
    const i = this.#stack.indexOf(scene);
    return i > 0 ? this.#stack[i - 1] : null;
  }

  /**
   * @param {Function} ctor
   * @returns {boolean} whether the top scene is an instance of ctor
   */
  topIs(ctor) {
    const top = this.current;
    return top !== null && top instanceof ctor;
  }

  /** @param {import('../core/Input.js').Input} input */
  update(input) {
    this.current?.update(input);
  }

  /**
   * Let the topmost scene that has a world draw it, unless an opaque scene
   * covers everything anyway.
   * @param {import('../gfx3d/SceneRenderer.js').SceneRenderer} world
   * @param {number} dt @param {number} time
   */
  renderWorld(world, dt, time) {
    const top = this.current;
    if (top === null || top.opaque) return;
    for (let i = this.#stack.length - 1; i >= 0; i--) {
      const scene = this.#stack[i];
      if (scene.hasWorld) { scene.renderWorld(world, dt, time); return; }
    }
  }

  /**
   * @param {import('../gfx/Screen.js').Screen} screen
   * @param {number} alpha
   */
  render(screen, alpha) {
    this.current?.render(screen, alpha);
  }
}
