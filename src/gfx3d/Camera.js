import * as M4 from './Mat4.js';

const EYE_DISTANCE = 60;

/**
 * Orthographic camera looking down at the grid from a fixed dimetric angle.
 * `zoom` is backbuffer pixels per world unit. The target is the point on
 * the ground the view is centred on; the game eases it toward the player.
 */
export class Camera {
  /** Rotation around the vertical axis, radians. */
  yaw = Math.PI / 4;
  /** Angle above the ground, radians (true isometric is ~0.6155). */
  pitch = 0.6155;
  zoom = 24;
  target = [0, 0, 0];

  view = M4.create();
  proj = M4.create();
  viewProj = M4.create();
  #inverse = M4.create();
  #width = 1;
  #height = 1;

  /** Unit vectors along the screen's right and up in world space (for billboards). */
  right = [1, 0, 0];
  up = [0, 1, 0];
  /** Direction from the camera into the scene. */
  forward = [0, -1, 0];

  /**
   * Recompute matrices for a backbuffer of the given size.
   * @param {number} width @param {number} height
   */
  update(width, height) {
    this.#width = width;
    this.#height = height;
    const cp = Math.cos(this.pitch);
    const eye = [
      this.target[0] + Math.sin(this.yaw) * cp * EYE_DISTANCE,
      this.target[1] + Math.sin(this.pitch) * EYE_DISTANCE,
      this.target[2] + Math.cos(this.yaw) * cp * EYE_DISTANCE,
    ];
    M4.lookAt(this.view, eye, this.target, [0, 1, 0]);
    const hw = width / (2 * this.zoom);
    const hh = height / (2 * this.zoom);
    M4.ortho(this.proj, -hw, hw, -hh, hh, 1, EYE_DISTANCE * 3);
    M4.multiply(this.viewProj, this.proj, this.view);
    M4.invert(this.#inverse, this.viewProj);

    this.forward = M4.normalize([this.target[0] - eye[0], this.target[1] - eye[1], this.target[2] - eye[2]]);
    this.right = M4.normalize(M4.cross(this.forward, [0, 1, 0]));
    this.up = M4.normalize(M4.cross(this.right, this.forward));
  }

  /**
   * Where a backbuffer pixel hits the horizontal plane at `height`.
   * @param {number} px @param {number} py
   * @param {number} [height] world y of the plane (0 = the floor)
   * @returns {{ x: number, z: number } | null}
   */
  pickGround(px, py, height = 0) {
    const nx = (px / this.#width) * 2 - 1;
    const ny = 1 - (py / this.#height) * 2;
    const near = M4.transformPoint(this.#inverse, [nx, ny, -1]);
    const far = M4.transformPoint(this.#inverse, [nx, ny, 1]);
    const dy = far[1] - near[1];
    if (Math.abs(dy) < 1e-6) return null;
    const t = (height - near[1]) / dy;
    if (t < 0) return null;
    return { x: near[0] + (far[0] - near[0]) * t, z: near[2] + (far[2] - near[2]) * t };
  }

  /**
   * Backbuffer pixel of a world point.
   * @param {number} x @param {number} y @param {number} z
   * @returns {{ x: number, y: number }}
   */
  project(x, y, z) {
    const p = M4.transformPoint(this.viewProj, [x, y, z]);
    return { x: (p[0] + 1) * 0.5 * this.#width, y: (1 - p[1]) * 0.5 * this.#height };
  }
}
