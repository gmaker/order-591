import { Config } from '../config.js';

const MS_PER_TICK = 1000 / Config.TICK_RATE;

/** @typedef {() => void} UpdateCallback */
/** @typedef {(alpha: number, dtMs: number) => void} RenderCallback */

/**
 * Fixed-timestep loop. Simulation advances in whole ticks at Config.TICK_RATE;
 * rendering happens once per animation frame with an interpolation factor.
 */
export class GameLoop {
  /** @type {UpdateCallback} */ #update;
  /** @type {RenderCallback} */ #render;

  #running = false;
  #tickCount = 0;
  /** Leftover ms not yet consumed by a full tick. */
  #accum = 0;
  /** @type {number|null} */ #lastTs = null;
  /** @type {number|null} */ #rafId = null;

  #fps = 0;
  #frames = 0;
  #fpsTimer = 0;

  /** @param {{ update: UpdateCallback, render: RenderCallback }} callbacks */
  constructor({ update, render }) {
    this.#update = update;
    this.#render = render;
  }

  // ── Read-only state ──────────────────────────────────────────────────────

  get running() { return this.#running; }
  get tickCount() { return this.#tickCount; }
  /** Animation frames per second over the last full second. */
  get fps() { return this.#fps; }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#lastTs = null;
    this.#rafId = requestAnimationFrame(ts => this.#frame(ts));
  }

  stop() {
    this.#running = false;
    if (this.#rafId !== null) cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /** @param {DOMHighResTimeStamp} ts */
  #frame(ts) {
    if (!this.#running) return;

    const raw = this.#lastTs === null ? 0 : ts - this.#lastTs;
    const delta = Math.min(raw, Config.MAX_CATCHUP_MS);
    this.#lastTs = ts;

    this.#frames++;
    this.#fpsTimer += raw;
    if (this.#fpsTimer >= 1000) {
      this.#fps = this.#frames;
      this.#frames = 0;
      this.#fpsTimer -= 1000;
    }

    this.#accum += delta;
    while (this.#accum >= MS_PER_TICK) {
      this.#update();
      this.#tickCount++;
      this.#accum -= MS_PER_TICK;
    }

    this.#render(this.#accum / MS_PER_TICK, delta);
    this.#rafId = requestAnimationFrame(t => this.#frame(t));
  }
}
