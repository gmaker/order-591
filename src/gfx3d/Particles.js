const MAX = 4096;
/** Floats per particle in the instance buffer: pos(3) color(4) size(1). */
export const PARTICLE_FLOATS = 8;

/**
 * Simple CPU particle pool. Particles are points with velocity, gravity,
 * a lifetime and a colour that fades out; the renderer draws them as
 * round billboards.
 */
export class Particles {
  #x = new Float32Array(MAX);
  #y = new Float32Array(MAX);
  #z = new Float32Array(MAX);
  #vx = new Float32Array(MAX);
  #vy = new Float32Array(MAX);
  #vz = new Float32Array(MAX);
  #life = new Float32Array(MAX);
  #maxLife = new Float32Array(MAX);
  #size = new Float32Array(MAX);
  #r = new Float32Array(MAX);
  #g = new Float32Array(MAX);
  #b = new Float32Array(MAX);
  #gravity = new Float32Array(MAX);
  #count = 0;

  /** Instance data for the renderer, valid after update(). */
  buffer = new Float32Array(MAX * PARTICLE_FLOATS);

  get count() { return this.#count; }

  /**
   * @param {object} p
   * @param {number} p.x @param {number} p.y @param {number} p.z
   * @param {number} [p.vx] @param {number} [p.vy] @param {number} [p.vz]
   * @param {number} p.life seconds
   * @param {number} p.size world units
   * @param {number} p.r @param {number} p.g @param {number} p.b
   * @param {number} [p.gravity]
   */
  spawn(p) {
    if (this.#count >= MAX) return;
    const i = this.#count++;
    this.#x[i] = p.x; this.#y[i] = p.y; this.#z[i] = p.z;
    this.#vx[i] = p.vx ?? 0; this.#vy[i] = p.vy ?? 0; this.#vz[i] = p.vz ?? 0;
    this.#life[i] = this.#maxLife[i] = p.life;
    this.#size[i] = p.size;
    this.#r[i] = p.r; this.#g[i] = p.g; this.#b[i] = p.b;
    this.#gravity[i] = p.gravity ?? 0;
  }

  /**
   * A burst of particles from a point with random velocities.
   * @param {number} x @param {number} y @param {number} z
   * @param {number} n
   * @param {{ r: number, g: number, b: number, speed?: number, life?: number, size?: number, gravity?: number, up?: number }} o
   */
  burst(x, y, z, n, o) {
    const speed = o.speed ?? 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn({
        x, y, z,
        vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: (o.up ?? 1.5) * (0.5 + Math.random()),
        life: (o.life ?? 0.5) * (0.6 + Math.random() * 0.8),
        size: (o.size ?? 0.12) * (0.6 + Math.random() * 0.8),
        r: o.r, g: o.g, b: o.b,
        gravity: o.gravity ?? 6,
      });
    }
  }

  /** @param {number} dt seconds */
  update(dt) {
    let n = this.#count;
    for (let i = 0; i < n; i++) {
      this.#life[i] -= dt;
      if (this.#life[i] <= 0) {
        n--;
        this.#swap(i, n);
        i--;
        continue;
      }
      this.#vy[i] -= this.#gravity[i] * dt;
      this.#x[i] += this.#vx[i] * dt;
      this.#y[i] += this.#vy[i] * dt;
      this.#z[i] += this.#vz[i] * dt;
      if (this.#y[i] < 0.02) { this.#y[i] = 0.02; this.#vy[i] *= -0.3; this.#vx[i] *= 0.7; this.#vz[i] *= 0.7; }
    }
    this.#count = n;

    const buf = this.buffer;
    for (let i = 0; i < n; i++) {
      const o = i * PARTICLE_FLOATS;
      const t = this.#life[i] / this.#maxLife[i];
      buf[o] = this.#x[i]; buf[o + 1] = this.#y[i]; buf[o + 2] = this.#z[i];
      buf[o + 3] = this.#r[i]; buf[o + 4] = this.#g[i]; buf[o + 5] = this.#b[i];
      buf[o + 6] = Math.min(1, t * 2);
      buf[o + 7] = this.#size[i] * (0.5 + 0.5 * t);
    }
  }

  /** @param {number} a @param {number} b */
  #swap(a, b) {
    if (a === b) return;
    const arrays = [this.#x, this.#y, this.#z, this.#vx, this.#vy, this.#vz, this.#life, this.#maxLife,
      this.#size, this.#r, this.#g, this.#b, this.#gravity];
    for (const arr of arrays) { const t = arr[a]; arr[a] = arr[b]; arr[b] = t; }
  }
}
