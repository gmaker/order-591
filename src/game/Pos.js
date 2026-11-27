/** Immutable grid position. */
export class Pos {
  /** @param {number} x @param {number} y */
  constructor(x, y) {
    this.x = x;
    this.y = y;
    Object.freeze(this);
  }

  /**
   * Squared euclidean distance (cheap, only ever compared).
   * @param {Pos} other
   */
  distanceTo(other) {
    const xd = other.x - this.x;
    const yd = other.y - this.y;
    return xd * xd + yd * yd;
  }
}
