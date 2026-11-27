import { GameLoop } from './core/GameLoop.js';
import { Input } from './core/Input.js';
import { GlContext } from './gfx/GlContext.js';
import { Renderer } from './gfx/Renderer.js';
import { Screen } from './gfx/Screen.js';
import { buildModels } from './gfx3d/Models.js';
import { SceneRenderer } from './gfx3d/SceneRenderer.js';
import { HelpScene } from './scenes/HelpScene.js';
import { SceneManager } from './scenes/SceneManager.js';
import { TitleScene } from './scenes/TitleScene.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas'));
const ctx = new GlContext(canvas);
const [overlay, world] = await Promise.all([
  Renderer.create(ctx),
  SceneRenderer.create(ctx, buildModels()),
]);
const screen = new Screen();
const input = new Input(window, canvas, (cx, cy) => ctx.toBackbuffer(cx, cy));
const scenes = new SceneManager();

const started = performance.now();

const loop = new GameLoop({
  update() {
    input.update();
    input.textMode = false; // scenes that take text opt in every tick
    if (input.typed().includes('?') && !scenes.topIs(HelpScene)) {
      scenes.push(new HelpScene());
    } else {
      scenes.update(input);
    }
  },
  render(alpha, dtMs) {
    const gl = ctx.gl;
    const time = (performance.now() - started) / 1000;
    gl.viewport(0, 0, ctx.width, ctx.height);
    gl.clearColor(0.02, 0.02, 0.03, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    world.begin();
    scenes.renderWorld(world, dtMs / 1000, time);
    world.draw(time);

    scenes.render(screen, alpha);
    overlay.drawScreen(screen, scenes.current?.opaque ?? true);
    overlay.uiBegin();
    scenes.current?.renderUi(overlay, input);
    overlay.uiFlush();
    overlay.drawVignette();
  },
});

scenes.change(new TitleScene());
canvas.focus();
loop.start();

// Handy from the devtools console.
globalThis.order591 = { loop, scenes, overlay, world, input };
