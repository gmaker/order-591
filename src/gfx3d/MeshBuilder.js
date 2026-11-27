/**
 * Builds flat-shaded meshes from primitives. Every face gets its own
 * vertices with the face normal, so lighting shows crisp low-poly facets.
 * Colours are per vertex (no textures anywhere in the game).
 *
 * Conventions: y is up, shapes are centred on x/z = 0 and stand on y = 0
 * unless an offset is given. `sway` is a per-vertex weight used by the
 * vertex shader to bend grass and leaves in the wind.
 */

/** @typedef {[number, number, number]} RGB */
/** @typedef {{ x?: number, y?: number, z?: number, sway?: boolean }} Place */

/**
 * @typedef {object} MeshData
 * @property {Float32Array} positions
 * @property {Float32Array} normals
 * @property {Float32Array} colors
 * @property {Float32Array} sway
 * @property {Uint16Array} indices
 */

export class MeshBuilder {
  /** @type {number[]} */ #pos = [];
  /** @type {number[]} */ #nrm = [];
  /** @type {number[]} */ #col = [];
  /** @type {number[]} */ #sway = [];
  /** @type {number[]} */ #idx = [];

  // ── Primitives ───────────────────────────────────────────────────────────

  /**
   * Axis-aligned box of size w×h×d standing on y.
   * @param {number} w @param {number} h @param {number} d @param {RGB} color @param {Place} [place]
   */
  box(w, h, d, color, place = {}) {
    const { x = 0, y = 0, z = 0 } = place;
    const x0 = x - w / 2, x1 = x + w / 2;
    const y0 = y, y1 = y + h;
    const z0 = z - d / 2, z1 = z + d / 2;
    const sw = place.sway ? h : 0;
    // Corners: p[xyz] bits
    const c = (bx, by, bz) => [bx ? x1 : x0, by ? y1 : y0, bz ? z1 : z0];
    this.#quad(c(0, 1, 0), c(0, 1, 1), c(1, 1, 1), c(1, 1, 0), color, sw, sw); // top
    this.#quad(c(0, 0, 1), c(1, 0, 1), c(1, 0, 0), c(0, 0, 0), color, 0, 0); // bottom
    this.#quad(c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1), color, 0, sw); // front (+z)
    this.#quad(c(1, 0, 0), c(0, 0, 0), c(0, 1, 0), c(1, 1, 0), color, 0, sw); // back (-z)
    this.#quad(c(1, 0, 1), c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), color, 0, sw); // right (+x)
    this.#quad(c(0, 0, 0), c(0, 0, 1), c(0, 1, 1), c(0, 1, 0), color, 0, sw); // left (-x)
    return this;
  }

  /**
   * Horizontal quad w×d at height y, facing up.
   * @param {number} w @param {number} d @param {RGB} color @param {Place} [place]
   */
  quad(w, d, color, place = {}) {
    const { x = 0, y = 0, z = 0 } = place;
    this.#quad(
      [x - w / 2, y, z - d / 2], [x - w / 2, y, z + d / 2],
      [x + w / 2, y, z + d / 2], [x + w / 2, y, z - d / 2],
      color, 0, 0,
    );
    return this;
  }

  /**
   * Vertical quad of width w and height h, standing on y, rotated by yaw
   * around its centre. Both sides are emitted so it reads from any angle.
   * @param {number} w @param {number} h @param {RGB} color @param {Place & { yaw?: number }} [place]
   */
  vquad(w, h, color, place = {}) {
    const { x = 0, y = 0, z = 0, yaw = 0 } = place;
    const dx = Math.cos(yaw) * w / 2;
    const dz = -Math.sin(yaw) * w / 2;
    const a = [x - dx, y, z - dz];
    const b = [x + dx, y, z + dz];
    const c = [x + dx, y + h, z + dz];
    const d = [x - dx, y + h, z - dz];
    const sw = place.sway ? h : 0;
    this.#quad(a, b, c, d, color, 0, sw);
    this.#quad(b, a, d, c, color, 0, sw);
    return this;
  }

  /**
   * A blade of grass: a two-sided triangle w wide at the foot and pointed
   * at the tip, leaning by `lean`, dark at the foot and light at the tip.
   * Normals point up so a field lights evenly instead of facet by facet;
   * the tip carries the sway weight.
   * @param {number} w @param {number} h @param {RGB} foot @param {RGB} tip
   * @param {Place & { yaw?: number, lean?: [number, number] }} [place]
   */
  blade(w, h, foot, tip, place = {}) {
    const { x = 0, y = 0, z = 0, yaw = 0, lean = [0, 0] } = place;
    const dx = Math.cos(yaw) * w / 2;
    const dz = -Math.sin(yaw) * w / 2;
    const a = [x - dx, y, z - dz];
    const b = [x + dx, y, z + dz];
    const c = [x + lean[0], y + h, z + lean[1]];
    this.#triUp(a, b, c, [foot, foot, tip], [0, 0, h]);
    this.#triUp(b, a, c, [foot, foot, tip], [0, 0, h]);
    return this;
  }

  /**
   * Cylinder (or cone when rTop is 0) of height h standing on y.
   * @param {number} r @param {number} h @param {number} segments @param {RGB} color
   * @param {Place & { rTop?: number }} [place]
   */
  cylinder(r, h, segments, color, place = {}) {
    const { x = 0, y = 0, z = 0, rTop = r } = place;
    const sw = place.sway ? h : 0;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const b0 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r];
      const b1 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
      const t0 = [x + Math.cos(a0) * rTop, y + h, z + Math.sin(a0) * rTop];
      const t1 = [x + Math.cos(a1) * rTop, y + h, z + Math.sin(a1) * rTop];
      if (rTop > 0) this.#quad(b0, t0, t1, b1, color, 0, sw);
      else this.#tri(b0, t0, b1, color, [0, sw, 0]);
      // caps
      this.#tri([x, y, z], b0, b1, color, [0, 0, 0]);
      if (rTop > 0) this.#tri([x, y + h, z], t1, t0, color, [sw, sw, sw]);
    }
    return this;
  }

  /**
   * Faceted sphere of radius r centred at height y + r (so it stands on y).
   * @param {number} r @param {number} segments @param {RGB} color
   * @param {Place & { squash?: number }} [place] squash scales y (1 = round)
   */
  sphere(r, segments, color, place = {}) {
    const { x = 0, y = 0, z = 0, squash = 1 } = place;
    const rings = Math.max(2, segments >> 1);
    const cy = y + r * squash;
    const p = (i, j) => {
      const theta = (j / rings) * Math.PI;
      const phi = (i / segments) * Math.PI * 2;
      return [
        x + Math.sin(theta) * Math.cos(phi) * r,
        cy - Math.cos(theta) * r * squash,
        z + Math.sin(theta) * Math.sin(phi) * r,
      ];
    };
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < segments; i++) {
        const a = p(i, j), b = p(i + 1, j), c = p(i + 1, j + 1), d = p(i, j + 1);
        if (j === 0) this.#tri(a, d, c, color, [0, 0, 0]);
        else if (j === rings - 1) this.#tri(a, d, b, color, [0, 0, 0]);
        else this.#quad(a, d, c, b, color, 0, 0);
      }
    }
    return this;
  }

  // ── Output ───────────────────────────────────────────────────────────────

  /** @returns {MeshData} */
  build() {
    if (this.#pos.length / 3 > 65535) throw new Error('Mesh exceeds 16-bit index range');
    return {
      positions: new Float32Array(this.#pos),
      normals: new Float32Array(this.#nrm),
      colors: new Float32Array(this.#col),
      sway: new Float32Array(this.#sway),
      indices: new Uint16Array(this.#idx),
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /**
   * Counter-clockwise quad a-b-c-d seen from its front.
   * @param {number[]} a @param {number[]} b @param {number[]} c @param {number[]} d
   * @param {RGB} color @param {number} swayBottom @param {number} swayTop
   */
  #quad(a, b, c, d, color, swayBottom, swayTop) {
    const n = faceNormal(a, b, c);
    const base = this.#pos.length / 3;
    const ys = [a[1], b[1], c[1], d[1]];
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    for (const v of [a, b, c, d]) {
      this.#pos.push(v[0], v[1], v[2]);
      this.#nrm.push(n[0], n[1], n[2]);
      this.#col.push(color[0], color[1], color[2]);
      const t = maxY === minY ? 1 : (v[1] - minY) / (maxY - minY);
      this.#sway.push(swayBottom + (swayTop - swayBottom) * t);
    }
    this.#idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * Triangle with an upward normal and a colour per vertex.
   * @param {number[]} a @param {number[]} b @param {number[]} c
   * @param {RGB[]} colors @param {number[]} sway per-vertex sway weights
   */
  #triUp(a, b, c, colors, sway) {
    const base = this.#pos.length / 3;
    [a, b, c].forEach((v, i) => {
      this.#pos.push(v[0], v[1], v[2]);
      this.#nrm.push(0, 1, 0);
      this.#col.push(colors[i][0], colors[i][1], colors[i][2]);
      this.#sway.push(sway[i]);
    });
    this.#idx.push(base, base + 1, base + 2);
  }

  /**
   * @param {number[]} a @param {number[]} b @param {number[]} c
   * @param {RGB} color @param {number[]} sway per-vertex sway weights
   */
  #tri(a, b, c, color, sway) {
    const n = faceNormal(a, b, c);
    const base = this.#pos.length / 3;
    [a, b, c].forEach((v, i) => {
      this.#pos.push(v[0], v[1], v[2]);
      this.#nrm.push(n[0], n[1], n[2]);
      this.#col.push(color[0], color[1], color[2]);
      this.#sway.push(sway[i]);
    });
    this.#idx.push(base, base + 1, base + 2);
  }
}

/**
 * @param {number[]} a @param {number[]} b @param {number[]} c
 * @returns {number[]} unit normal of triangle a-b-c
 */
function faceNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}
