import { Config } from '../config.js';
import { Rng } from '../core/Rng.js';
import { ATLAS_CELLS, ATLAS_SIZE, G, buildAtlas, charToGlyph } from './Atlas.js';
import { GlContext } from './GlContext.js';
import { BG, FG } from './Palette.js';

const FLOATS_PER_VERTEX = 8; // x y u v r g b a
const VERTS_PER_QUAD = 6;

/**
 * Glyph overlay renderer. Turns the Screen's cell grid into textured quads
 * (one batch with the atlas) and can add a vignette on top. It never clears
 * the framebuffer: the 3D scene is drawn first, this goes over it.
 *
 * Opaque mode draws a background square for every cell (full-screen text
 * scenes). Transparent mode only darkens the cells that hold a glyph, so the
 * HUD reads over the world without hiding it.
 */
export class Renderer {
  /** @type {GlContext} */ #ctx;
  /** @type {WebGLProgram} */ #program;
  /** @type {WebGLVertexArrayObject} */ #vao;
  /** @type {WebGLBuffer} */ #vbo;
  /** @type {WebGLTexture} */ #atlasTex;
  /** @type {WebGLTexture} */ #vignetteTex;
  /** @type {WebGLUniformLocation|null} */ #uResolution;
  /** @type {WebGLUniformLocation|null} */ #uTex;

  #verts;
  #vertCount = 0;
  #drawCalls = 0;

  /** @param {GlContext} ctx */
  static async create(ctx) {
    const [vs, fs] = await Promise.all([
      GlContext.loadText('./shaders/sprite.vert.glsl', import.meta.url),
      GlContext.loadText('./shaders/sprite.frag.glsl', import.meta.url),
    ]);
    return new Renderer(ctx, vs, fs);
  }

  /**
   * @param {GlContext} ctx
   * @param {string} vertSrc @param {string} fragSrc
   */
  constructor(ctx, vertSrc, fragSrc) {
    this.#ctx = ctx;
    const gl = ctx.gl;
    this.#program = ctx.createProgram(vertSrc, fragSrc);
    this.#uResolution = gl.getUniformLocation(this.#program, 'u_resolution');
    this.#uTex = gl.getUniformLocation(this.#program, 'u_tex');

    const maxQuads = Config.COLS * Config.ROWS * 2 + 1;
    this.#verts = new Float32Array(maxQuads * VERTS_PER_QUAD * FLOATS_PER_VERTEX);

    this.#vao = /** @type {WebGLVertexArrayObject} */ (gl.createVertexArray());
    this.#vbo = /** @type {WebGLBuffer} */ (gl.createBuffer());
    gl.bindVertexArray(this.#vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.#verts.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS_PER_VERTEX * 4;
    const aPos = gl.getAttribLocation(this.#program, 'a_pos');
    const aUv = gl.getAttribLocation(this.#program, 'a_uv');
    const aColor = gl.getAttribLocation(this.#program, 'a_color');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, stride, 16);
    gl.bindVertexArray(null);

    this.#atlasTex = ctx.createTexture(ATLAS_SIZE, ATLAS_SIZE, buildAtlas());
    this.#vignetteTex = ctx.createTexture(ctx.width, ctx.height, buildVignette(ctx.width, ctx.height));
  }

  get drawCalls() { return this.#drawCalls; }

  // ── Frame ────────────────────────────────────────────────────────────────

  /**
   * Draw the glyph screen.
   * @param {import('./Screen.js').Screen} screen
   * @param {boolean} opaque background squares for every cell, or only under glyphs
   */
  drawScreen(screen, opaque) {
    const gl = this.#ctx.gl;
    const cell = Config.CELL;
    this.#drawCalls = 0;
    this.#beginPass();

    this.#vertCount = 0;
    const cols = screen.cols;
    const rows = screen.rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = x + y * cols;
        const glyph = screen.glyphAt(i);
        if (opaque) {
          const color = screen.colorAt(i) * 3;
          this.#pushGlyph(x * cell, y * cell, G.SOLID, BG[color], BG[color + 1], BG[color + 2], 1);
        } else if (glyph !== G.SPACE) {
          this.#pushGlyph(x * cell, y * cell, G.SOLID, 0, 0, 0, 0.55);
        }
      }
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = x + y * cols;
        const glyph = screen.glyphAt(i);
        if (glyph === G.SPACE) continue;
        const color = screen.colorAt(i) * 3;
        this.#pushGlyph(x * cell, y * cell, glyph, FG[color], FG[color + 1], FG[color + 2], 1);
      }
    }
    this.#flush(this.#atlasTex);
  }

  // ── Immediate-mode UI in backbuffer pixels ───────────────────────────────

  /** Start a UI batch (after drawScreen). Calls below queue quads; uiFlush() draws them. */
  uiBegin() {
    this.#beginPass();
    this.#vertCount = 0;
  }

  /**
   * Filled rectangle.
   * @param {number} x @param {number} y @param {number} w @param {number} h
   * @param {number} r @param {number} g @param {number} b @param {number} a
   */
  uiRect(x, y, w, h, r, g, b, a) {
    this.#ensureRoom(1);
    const cellUv = 1 / ATLAS_CELLS;
    const u0 = (G.SOLID % ATLAS_CELLS) * cellUv + cellUv * 0.25;
    const v0 = Math.floor(G.SOLID / ATLAS_CELLS) * cellUv + cellUv * 0.25;
    this.#pushQuad(x, y, w, h, u0, v0, u0 + cellUv * 0.5, v0 + cellUv * 0.5, r, g, b, a);
  }

  /**
   * One-pixel frame.
   * @param {number} x @param {number} y @param {number} w @param {number} h
   * @param {number} r @param {number} g @param {number} b @param {number} a
   */
  uiFrame(x, y, w, h, r, g, b, a) {
    this.uiRect(x, y, w, 1, r, g, b, a);
    this.uiRect(x, y + h - 1, w, 1, r, g, b, a);
    this.uiRect(x, y, 1, h, r, g, b, a);
    this.uiRect(x + w - 1, y, 1, h, r, g, b, a);
  }

  /**
   * An atlas glyph scaled up.
   * @param {number} x @param {number} y @param {number} glyph
   * @param {number} color palette index @param {number} scale @param {number} [alpha]
   */
  uiGlyph(x, y, glyph, color, scale, alpha = 1) {
    this.#ensureRoom(1);
    const c = color * 3;
    const cellUv = 1 / ATLAS_CELLS;
    const u0 = (glyph % ATLAS_CELLS) * cellUv;
    const v0 = Math.floor(glyph / ATLAS_CELLS) * cellUv;
    const size = Config.CELL * scale;
    this.#pushQuad(x, y, size, size, u0, v0, u0 + cellUv, v0 + cellUv, FG[c], FG[c + 1], FG[c + 2], alpha);
  }

  /**
   * Text with §-colour codes; returns the x after the last character.
   * @param {number} x @param {number} y @param {string} text
   * @param {number} color palette index @param {number} [scale] @param {number} [alpha]
   */
  uiText(x, y, text, color, scale = 1, alpha = 1) {
    let col = color;
    let cx = x;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '§' && i + 1 < text.length) {
        const parsed = parseInt(text[i + 1], 16);
        col = Number.isNaN(parsed) ? color : parsed;
        i++;
        continue;
      }
      this.uiGlyph(cx, y, charToGlyph(ch), col, scale, alpha);
      cx += Config.CELL * scale;
    }
    return cx;
  }

  /**
   * Width in pixels of a text at a scale (ignoring §-codes).
   * @param {string} text @param {number} [scale]
   */
  static uiTextWidth(text, scale = 1) {
    let n = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '§' && i + 1 < text.length) { i++; continue; }
      n++;
    }
    return n * Config.CELL * scale;
  }

  /** Draw everything queued since uiBegin(). */
  uiFlush() {
    this.#flush(this.#atlasTex);
    this.#vertCount = 0;
  }

  /** Flush early if the next quads would not fit. @param {number} quads */
  #ensureRoom(quads) {
    if ((this.#vertCount + quads * VERTS_PER_QUAD) * FLOATS_PER_VERTEX > this.#verts.length) this.uiFlush();
  }

  /** Darken the edges with grain. */
  drawVignette() {
    this.#beginPass();
    this.#vertCount = 0;
    this.#pushQuad(0, 0, this.#ctx.width, this.#ctx.height, 0, 0, 1, 1, 0, 0, 0, 1);
    this.#flush(this.#vignetteTex);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  #beginPass() {
    const gl = this.#ctx.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, this.#ctx.width, this.#ctx.height);
    gl.useProgram(this.#program);
    gl.uniform2f(this.#uResolution, this.#ctx.width, this.#ctx.height);
    gl.uniform1i(this.#uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(this.#vao);
  }

  #pushGlyph(x, y, glyph, r, g, b, a) {
    const cellUv = 1 / ATLAS_CELLS;
    const u0 = (glyph % ATLAS_CELLS) * cellUv;
    const v0 = Math.floor(glyph / ATLAS_CELLS) * cellUv;
    this.#pushQuad(x, y, Config.CELL, Config.CELL, u0, v0, u0 + cellUv, v0 + cellUv, r, g, b, a);
  }

  #pushQuad(x, y, w, h, u0, v0, u1, v1, r, g, b, a) {
    const v = this.#verts;
    let i = this.#vertCount * FLOATS_PER_VERTEX;
    const x1 = x + w;
    const y1 = y + h;
    const put = (px, py, pu, pv) => {
      v[i++] = px; v[i++] = py; v[i++] = pu; v[i++] = pv;
      v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    };
    put(x, y, u0, v0);
    put(x1, y, u1, v0);
    put(x, y1, u0, v1);
    put(x1, y, u1, v0);
    put(x1, y1, u1, v1);
    put(x, y1, u0, v1);
    this.#vertCount += VERTS_PER_QUAD;
  }

  /** @param {WebGLTexture} texture */
  #flush(texture) {
    if (this.#vertCount === 0) return;
    const gl = this.#ctx.gl;
    gl.bindVertexArray(this.#vao);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.#verts, 0, this.#vertCount * FLOATS_PER_VERTEX);
    gl.drawArrays(gl.TRIANGLES, 0, this.#vertCount);
    this.#drawCalls++;
  }
}

/**
 * Darkening overlay: radial falloff toward the corners plus film grain.
 * @param {number} width @param {number} height
 * @returns {Uint8Array} RGBA, black with varying alpha
 */
function buildVignette(width, height) {
  const data = new Uint8Array(width * height * 4);
  const rng = new Rng(0x5911);
  let nn = rng.nextFloat() * 0.1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const xd = (x / (width - 1) - 0.5) / 0.8;
      const yd = (y / (height - 1) - 0.5) / 0.8;
      const d = Math.sqrt(xd * xd + yd * yd);
      if (rng.nextFloat() < 0.2) nn = rng.nextFloat() * 0.1;
      const grain = rng.nextFloat() * rng.nextFloat() * 0.1;
      const a = Math.min(255, Math.floor((d * d * d * d + nn + grain) * 200));
      data[(y * width + x) * 4 + 3] = a;
    }
  }
  return data;
}
