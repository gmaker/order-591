import { Config } from '../config.js';

/**
 * Owns the canvas and the WebGL2 context. The backbuffer is exactly
 * Config.WIDTH×HEIGHT and CSS scales it up by Config.SCALE, so both the 3D
 * scene and the glyph overlay render at the low logical resolution.
 */
export class GlContext {
  /** @type {HTMLCanvasElement} */ canvas;
  /** @type {WebGL2RenderingContext} */ gl;
  width = Config.WIDTH;
  height = Config.HEIGHT;

  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = this.width;
    canvas.height = this.height;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.fitToWindow();
    window.addEventListener('resize', () => this.fitToWindow());
  }

  /**
   * Pick the largest integer scale (up to Config.SCALE) that fits the window,
   * so the pixels stay crisp on small screens too.
   */
  fitToWindow() {
    const fit = Math.floor(Math.min(window.innerWidth / this.width, window.innerHeight / this.height));
    const scale = Math.max(1, Math.min(Config.SCALE, fit));
    this.canvas.style.width = `${this.width * scale}px`;
    this.canvas.style.height = `${this.height * scale}px`;
  }

  /**
   * Fetch a shader source relative to a module.
   * @param {string} relativePath
   * @param {string} base import.meta.url of the caller
   */
  static async loadText(relativePath, base) {
    const res = await fetch(new URL(relativePath, base));
    if (!res.ok) throw new Error(`Failed to load ${relativePath}: ${res.status}`);
    return res.text();
  }

  /**
   * Compile and link a program.
   * @param {string} vertSrc @param {string} fragSrc
   */
  createProgram(vertSrc, fragSrc) {
    const gl = this.gl;
    const compile = (type, src) => {
      const shader = /** @type {WebGLShader} */ (gl.createShader(type));
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
      }
      return shader;
    };
    const program = /** @type {WebGLProgram} */ (gl.createProgram());
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    return program;
  }

  /**
   * Nearest-filtered RGBA texture from raw bytes.
   * @param {number} width @param {number} height @param {Uint8Array} rgba
   */
  createTexture(width, height, rgba) {
    const gl = this.gl;
    const tex = /** @type {WebGLTexture} */ (gl.createTexture());
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    return tex;
  }

  /**
   * Convert a mouse event's client position to backbuffer pixels.
   * @param {number} clientX @param {number} clientY
   */
  toBackbuffer(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * this.width,
      y: ((clientY - rect.top) / rect.height) * this.height,
    };
  }
}
