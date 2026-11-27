import { GlContext } from '../gfx/GlContext.js';
import { Camera } from './Camera.js';
import { Particles, PARTICLE_FLOATS } from './Particles.js';

/** Floats per mesh instance: pos(3) rotScale(4) tint(4) extra(4). */
const INSTANCE_FLOATS = 15;
const MAX_LIGHTS = 16;
const INITIAL_CAPACITY = 64;

/**
 * Draws the world: every model is rendered with one instanced call, then
 * particles as billboards. Callers fill a frame with begin()/add()/lights
 * and then draw(); nothing is retained between frames except buffers.
 */
export class SceneRenderer {
  /** @type {GlContext} */ #ctx;
  /** @type {WebGLProgram} */ #meshProgram;
  /** @type {WebGLProgram} */ #particleProgram;
  /** @type {Record<string, WebGLUniformLocation|null>} */ #mu = {};
  /** @type {Record<string, WebGLUniformLocation|null>} */ #pu = {};

  /** @type {{ vao: WebGLVertexArrayObject, instanceBuf: WebGLBuffer, indexCount: number, data: Float32Array, count: number }[]} */
  #models = [];

  /** @type {WebGLVertexArrayObject} */ #particleVao;
  /** @type {WebGLBuffer} */ #particleBuf;

  #lightPos = new Float32Array(MAX_LIGHTS * 4);
  #lightColor = new Float32Array(MAX_LIGHTS * 3);
  #lightCount = 0;
  #ambient = [0.3, 0.32, 0.38];
  #sunDir = [0.4, 1, 0.3];
  #sunColor = [0.5, 0.5, 0.55];

  camera = new Camera();
  particles = new Particles();
  #drawCalls = 0;

  /**
   * @param {GlContext} ctx
   * @param {import('./MeshBuilder.js').MeshData[]} models
   */
  static async create(ctx, models) {
    const [mv, mf, pv, pf] = await Promise.all([
      GlContext.loadText('./shaders/mesh.vert.glsl', import.meta.url),
      GlContext.loadText('./shaders/mesh.frag.glsl', import.meta.url),
      GlContext.loadText('./shaders/particle.vert.glsl', import.meta.url),
      GlContext.loadText('./shaders/particle.frag.glsl', import.meta.url),
    ]);
    return new SceneRenderer(ctx, models, mv, mf, pv, pf);
  }

  /**
   * @param {GlContext} ctx
   * @param {import('./MeshBuilder.js').MeshData[]} models
   * @param {string} mv @param {string} mf @param {string} pv @param {string} pf
   */
  constructor(ctx, models, mv, mf, pv, pf) {
    this.#ctx = ctx;
    const gl = ctx.gl;
    this.#meshProgram = ctx.createProgram(mv, mf);
    this.#particleProgram = ctx.createProgram(pv, pf);
    for (const name of ['u_viewProj', 'u_time', 'u_ambient', 'u_sunDir', 'u_sunColor', 'u_lightCount', 'u_lightPos', 'u_lightColor']) {
      this.#mu[name] = gl.getUniformLocation(this.#meshProgram, name);
    }
    for (const name of ['u_viewProj', 'u_right', 'u_up']) {
      this.#pu[name] = gl.getUniformLocation(this.#particleProgram, name);
    }
    for (const mesh of models) this.#models.push(this.#uploadModel(mesh));
    this.#setupParticles();
    this.camera.zoom = 24;
  }

  get drawCalls() { return this.#drawCalls; }

  // ── Frame description ────────────────────────────────────────────────────

  begin() {
    for (const m of this.#models) m.count = 0;
    this.#lightCount = 0;
  }

  /**
   * Queue one instance of a model.
   * @param {number} model @param {number} x @param {number} y @param {number} z
   * @param {number} yaw @param {number} sx @param {number} sy @param {number} sz
   * @param {number} r @param {number} g @param {number} b @param {number} bright
   * @param {number} [emissive] @param {number} [sway] @param {number} [flash]
   * @param {number} [alpha] 0..1, rendered as dithered transparency
   */
  add(model, x, y, z, yaw, sx, sy, sz, r, g, b, bright, emissive = 0, sway = 0, flash = 0, alpha = 1) {
    const m = this.#models[model];
    if ((m.count + 1) * INSTANCE_FLOATS > m.data.length) {
      const grown = new Float32Array(m.data.length * 2);
      grown.set(m.data);
      m.data = grown;
    }
    const d = m.data;
    let i = m.count * INSTANCE_FLOATS;
    d[i++] = x; d[i++] = y; d[i++] = z;
    d[i++] = yaw; d[i++] = sx; d[i++] = sy; d[i++] = sz;
    d[i++] = r; d[i++] = g; d[i++] = b; d[i++] = bright;
    d[i++] = emissive; d[i++] = sway; d[i++] = flash; d[i++] = alpha;
    m.count++;
  }

  /**
   * @param {number} x @param {number} y @param {number} z @param {number} radius
   * @param {number} r @param {number} g @param {number} b
   */
  addLight(x, y, z, radius, r, g, b) {
    if (this.#lightCount >= MAX_LIGHTS) return;
    const i = this.#lightCount++;
    this.#lightPos.set([x, y, z, radius], i * 4);
    this.#lightColor.set([r, g, b], i * 3);
  }

  /** @param {number} r @param {number} g @param {number} b */
  setAmbient(r, g, b) { this.#ambient = [r, g, b]; }

  /**
   * @param {number} dx @param {number} dy @param {number} dz direction toward the sun
   * @param {number} r @param {number} g @param {number} b
   */
  setSun(dx, dy, dz, r, g, b) {
    const len = Math.hypot(dx, dy, dz) || 1;
    this.#sunDir = [dx / len, dy / len, dz / len];
    this.#sunColor = [r, g, b];
  }

  // ── Drawing ──────────────────────────────────────────────────────────────

  /**
   * Render the queued frame. Assumes the caller cleared the framebuffer.
   * @param {number} time seconds, for wind
   */
  draw(time) {
    const gl = this.#ctx.gl;
    const cam = this.camera;
    cam.update(this.#ctx.width, this.#ctx.height);
    this.#drawCalls = 0;

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);

    gl.useProgram(this.#meshProgram);
    gl.uniformMatrix4fv(this.#mu.u_viewProj, false, cam.viewProj);
    gl.uniform1f(this.#mu.u_time, time);
    gl.uniform3fv(this.#mu.u_ambient, this.#ambient);
    gl.uniform3fv(this.#mu.u_sunDir, this.#sunDir);
    gl.uniform3fv(this.#mu.u_sunColor, this.#sunColor);
    gl.uniform1i(this.#mu.u_lightCount, this.#lightCount);
    gl.uniform4fv(this.#mu.u_lightPos, this.#lightPos);
    gl.uniform3fv(this.#mu.u_lightColor, this.#lightColor);

    for (const m of this.#models) {
      if (m.count === 0) continue;
      gl.bindVertexArray(m.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.instanceBuf);
      gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.DYNAMIC_DRAW, 0, m.count * INSTANCE_FLOATS);
      gl.drawElementsInstanced(gl.TRIANGLES, m.indexCount, gl.UNSIGNED_SHORT, 0, m.count);
      this.#drawCalls++;
    }

    const particles = this.particles;
    if (particles.count > 0) {
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(this.#particleProgram);
      gl.uniformMatrix4fv(this.#pu.u_viewProj, false, cam.viewProj);
      gl.uniform3fv(this.#pu.u_right, cam.right);
      gl.uniform3fv(this.#pu.u_up, cam.up);
      gl.bindVertexArray(this.#particleVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.#particleBuf);
      gl.bufferData(gl.ARRAY_BUFFER, particles.buffer, gl.DYNAMIC_DRAW, 0, particles.count * PARTICLE_FLOATS);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, particles.count);
      this.#drawCalls++;
      gl.depthMask(true);
    }

    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  /** @param {import('./MeshBuilder.js').MeshData} mesh */
  #uploadModel(mesh) {
    const gl = this.#ctx.gl;
    const prog = this.#meshProgram;
    const vao = /** @type {WebGLVertexArrayObject} */ (gl.createVertexArray());
    gl.bindVertexArray(vao);

    const attrib = (name, data, size) => {
      const loc = gl.getAttribLocation(prog, name);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attrib('a_position', mesh.positions, 3);
    attrib('a_normal', mesh.normals, 3);
    attrib('a_color', mesh.colors, 3);
    attrib('a_sway', mesh.sway, 1);

    const indexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    const instanceBuf = /** @type {WebGLBuffer} */ (gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf);
    const stride = INSTANCE_FLOATS * 4;
    const inst = (name, size, offset) => {
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
      gl.vertexAttribDivisor(loc, 1);
    };
    inst('a_iPos', 3, 0);
    inst('a_iRotScale', 4, 3);
    inst('a_iTint', 4, 7);
    inst('a_iExtra', 4, 11);
    gl.bindVertexArray(null);

    return {
      vao,
      instanceBuf,
      indexCount: mesh.indices.length,
      data: new Float32Array(INITIAL_CAPACITY * INSTANCE_FLOATS),
      count: 0,
    };
  }

  #setupParticles() {
    const gl = this.#ctx.gl;
    const prog = this.#particleProgram;
    this.#particleVao = /** @type {WebGLVertexArrayObject} */ (gl.createVertexArray());
    gl.bindVertexArray(this.#particleVao);

    const cornerBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
    ]), gl.STATIC_DRAW);
    const cornerLoc = gl.getAttribLocation(prog, 'a_corner');
    gl.enableVertexAttribArray(cornerLoc);
    gl.vertexAttribPointer(cornerLoc, 2, gl.FLOAT, false, 0, 0);

    this.#particleBuf = /** @type {WebGLBuffer} */ (gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#particleBuf);
    const stride = PARTICLE_FLOATS * 4;
    const inst = (name, size, offset) => {
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
      gl.vertexAttribDivisor(loc, 1);
    };
    inst('a_iPos', 3, 0);
    inst('a_iColor', 4, 3);
    inst('a_iSize', 1, 7);
    gl.bindVertexArray(null);
  }
}
