import { Config } from '../config.js';

/** Logical actions the game understands; scenes never look at raw key codes. */
export const Action = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  UP_LEFT: 'upLeft',
  UP_RIGHT: 'upRight',
  DOWN_LEFT: 'downLeft',
  DOWN_RIGHT: 'downRight',
  WAIT: 'wait',
  CONFIRM: 'confirm',
  CANCEL: 'cancel',
  CLOSE_DOORS: 'closeDoors',
});

/** @type {Record<string, string[]>} action → KeyboardEvent.code list */
const BINDINGS = {
  [Action.UP]:          ['ArrowUp', 'Numpad8', 'KeyK'],
  [Action.DOWN]:        ['ArrowDown', 'Numpad2', 'KeyJ'],
  [Action.LEFT]:        ['ArrowLeft', 'Numpad4', 'KeyH'],
  [Action.RIGHT]:       ['ArrowRight', 'Numpad6', 'KeyL'],
  [Action.UP_LEFT]:     ['Numpad7', 'Home', 'KeyY'],
  [Action.UP_RIGHT]:    ['Numpad9', 'PageUp', 'KeyU'],
  [Action.DOWN_LEFT]:   ['Numpad1', 'End', 'KeyB'],
  [Action.DOWN_RIGHT]:  ['Numpad3', 'PageDown', 'KeyN'],
  [Action.WAIT]:        ['Numpad5', 'Period', 'Space'],
  [Action.CONFIRM]:     ['Space', 'Enter', 'NumpadEnter'],
  [Action.CANCEL]:      ['Escape'],
  [Action.CLOSE_DOORS]: ['KeyC', 'KeyQ'],
};

/** Actions that auto-repeat while held. */
const REPEATING = new Set([
  Action.UP, Action.DOWN, Action.LEFT, Action.RIGHT,
  Action.UP_LEFT, Action.UP_RIGHT, Action.DOWN_LEFT, Action.DOWN_RIGHT,
  Action.WAIT,
]);

/** Direction actions in priority order with their deltas. */
const DIRECTIONS = [
  [Action.UP_LEFT, -1, -1], [Action.UP, 0, -1], [Action.UP_RIGHT, 1, -1],
  [Action.LEFT, -1, 0], [Action.RIGHT, 1, 0],
  [Action.DOWN_LEFT, -1, 1], [Action.DOWN, 0, 1], [Action.DOWN_RIGHT, 1, 1],
];

const LETTER_CODE = /^Key[A-Z]$/;

/** @typedef {{ x: number, y: number, button: number }} Click */

/**
 * Keyboard and mouse state sampled once per simulation tick. Events are
 * queued as they arrive and become visible to the game only when update()
 * runs, so every scene sees a consistent snapshot for the whole tick.
 * Mouse coordinates are in backbuffer pixels.
 */
export class Input {
  /** @type {Map<string, number>} held codes → ticks held */
  #held = new Map();
  /** @type {Set<string>} */ #pressedQueue = new Set();
  /** @type {Set<string>} */ #pressed = new Set();
  /** @type {string[]} */ #typedQueue = [];
  /** @type {string[]} */ #typed = [];
  #shift = false;
  /** @type {Set<string>} every bound code, for preventDefault */
  #boundCodes = new Set();
  #anyKeyQueue = false;
  #anyKey = false;

  /** @type {Click[]} */ #clickQueue = [];
  /** @type {Click[]} */ #clicks = [];
  #mouseX = -1;
  #mouseY = -1;
  #buttons = 0;
  /** @type {(cx: number, cy: number) => { x: number, y: number }} */
  #toBackbuffer;

  /** When true, letter keys only produce typed text and never trigger actions. */
  textMode = false;

  /**
   * @param {EventTarget} target keyboard source (window)
   * @param {HTMLElement} canvas mouse source
   * @param {(cx: number, cy: number) => { x: number, y: number }} toBackbuffer client → backbuffer px
   */
  constructor(target, canvas, toBackbuffer) {
    this.#toBackbuffer = toBackbuffer;
    for (const codes of Object.values(BINDINGS)) {
      for (const code of codes) this.#boundCodes.add(code);
    }
    target.addEventListener('keydown', e => this.#onKeyDown(/** @type {KeyboardEvent} */ (e)));
    target.addEventListener('keyup', e => this.#onKeyUp(/** @type {KeyboardEvent} */ (e)));
    target.addEventListener('blur', () => { this.#held.clear(); this.#buttons = 0; });

    canvas.addEventListener('mousemove', e => this.#onMouseMove(/** @type {MouseEvent} */ (e)));
    canvas.addEventListener('mousedown', e => this.#onMouseDown(/** @type {MouseEvent} */ (e)));
    canvas.addEventListener('mouseup', e => { this.#buttons = /** @type {MouseEvent} */ (e).buttons; });
    canvas.addEventListener('mouseleave', () => { this.#mouseX = -1; this.#mouseY = -1; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ── Per-tick sampling ────────────────────────────────────────────────────

  /** Promote queued events to the current tick's snapshot. Call once per tick. */
  update() {
    this.#pressed = this.#pressedQueue;
    this.#pressedQueue = new Set();
    this.#typed = this.#typedQueue;
    this.#typedQueue = [];
    this.#clicks = this.#clickQueue;
    this.#clickQueue = [];
    this.#anyKey = this.#anyKeyQueue;
    this.#anyKeyQueue = false;
    for (const [code, ticks] of this.#held) this.#held.set(code, ticks + 1);
  }

  // ── Keyboard queries ─────────────────────────────────────────────────────

  get shift() { return this.#shift; }

  /** True if any key was pressed this tick (used to interrupt auto-walk). */
  get anyKeyPressed() { return this.#anyKey; }

  /** Characters typed this tick ('\b' for Backspace). */
  typed() { return this.#typed; }

  /**
   * True on the tick the action was pressed, and again on auto-repeat while
   * held (for repeating actions only).
   * @param {string} action
   */
  isTriggered(action) {
    const codes = BINDINGS[action];
    if (!codes) return false;
    const repeats = REPEATING.has(action);
    for (const code of codes) {
      if (this.textMode && LETTER_CODE.test(code)) continue;
      if (this.#pressed.has(code)) return true;
      if (!repeats) continue;
      const ticks = this.#held.get(code);
      if (ticks === undefined) continue;
      const over = ticks - Config.KEY_REPEAT_DELAY;
      if (over >= 0 && over % Config.KEY_REPEAT_INTERVAL === 0) return true;
    }
    return false;
  }

  /**
   * True only on the tick the action was pressed (no repeat).
   * @param {string} action
   */
  isPressed(action) {
    const codes = BINDINGS[action];
    if (!codes) return false;
    for (const code of codes) {
      if (this.textMode && LETTER_CODE.test(code)) continue;
      if (this.#pressed.has(code)) return true;
    }
    return false;
  }

  /** @param {string} action */
  isDown(action) {
    const codes = BINDINGS[action];
    if (!codes) return false;
    for (const code of codes) {
      if (this.textMode && LETTER_CODE.test(code)) continue;
      if (this.#held.has(code)) return true;
    }
    return false;
  }

  /**
   * The triggered movement direction this tick, or null.
   * @returns {{ x: number, y: number } | null}
   */
  direction() {
    for (const [action, x, y] of DIRECTIONS) {
      if (this.isTriggered(action)) return { x, y };
    }
    return null;
  }

  // ── Mouse queries ────────────────────────────────────────────────────────

  /** Pointer position in backbuffer pixels, or null when outside the canvas. */
  get mouse() {
    if (this.#mouseX < 0) return null;
    return { x: this.#mouseX, y: this.#mouseY };
  }

  /** @param {number} button 0 left, 1 middle, 2 right */
  isMouseDown(button) { return (this.#buttons & (1 << (button === 1 ? 2 : button === 2 ? 1 : 0))) !== 0; }

  /** Clicks that happened this tick. */
  clicks() { return this.#clicks; }

  // ── Events ───────────────────────────────────────────────────────────────

  /** @param {KeyboardEvent} e */
  #onKeyDown(e) {
    this.#shift = e.shiftKey;
    if (this.#boundCodes.has(e.code) || e.key === '?' || e.key === 'Backspace') e.preventDefault();
    if (e.repeat) return;
    this.#anyKeyQueue = true;
    this.#pressedQueue.add(e.code);
    this.#held.set(e.code, 0);
    if (e.key.length === 1) this.#typedQueue.push(e.key);
    else if (e.key === 'Backspace') this.#typedQueue.push('\b');
  }

  /** @param {KeyboardEvent} e */
  #onKeyUp(e) {
    this.#shift = e.shiftKey;
    this.#held.delete(e.code);
  }

  /** @param {MouseEvent} e */
  #onMouseMove(e) {
    const p = this.#toBackbuffer(e.clientX, e.clientY);
    this.#mouseX = p.x;
    this.#mouseY = p.y;
  }

  /** @param {MouseEvent} e */
  #onMouseDown(e) {
    e.preventDefault();
    /** @type {HTMLElement} */ (e.currentTarget).focus?.();
    this.#buttons = e.buttons;
    const p = this.#toBackbuffer(e.clientX, e.clientY);
    this.#mouseX = p.x;
    this.#mouseY = p.y;
    this.#clickQueue.push({ x: p.x, y: p.y, button: e.button });
  }
}
