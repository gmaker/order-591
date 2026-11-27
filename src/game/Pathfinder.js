/**
 * Breadth-first search on the grid with 8-way movement. Floors are small
 * enough that plain BFS is instant, and it gives the shortest path in steps,
 * which is what a turn-based walk wants.
 */

/** @typedef {{ x: number, y: number }} Step */

const DIRS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/**
 * @param {number} width @param {number} height
 * @param {number} sx @param {number} sy start
 * @param {number} tx @param {number} ty target
 * @param {(x: number, y: number) => boolean} passable
 * @returns {Step[] | null} steps from the cell after start up to and including target
 */
export function findPath(width, height, sx, sy, tx, ty, passable) {
  if (sx === tx && sy === ty) return [];
  if (tx < 0 || ty < 0 || tx >= width || ty >= height) return null;
  const prev = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const start = sx + sy * width;
  const goal = tx + ty * width;
  prev[start] = start;
  queue[tail++] = start;

  while (head < tail) {
    const cur = queue[head++];
    if (cur === goal) break;
    const cx = cur % width;
    const cy = (cur / width) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = nx + ny * width;
      if (prev[n] !== -1) continue;
      // The goal itself may be blocked (a door, a chest): walking into it is the point.
      if (n !== goal && !passable(nx, ny)) continue;
      prev[n] = cur;
      queue[tail++] = n;
    }
  }
  if (prev[goal] === -1) return null;

  /** @type {Step[]} */
  const path = [];
  for (let c = goal; c !== start; c = prev[c]) path.push({ x: c % width, y: (c / width) | 0 });
  path.reverse();
  return path;
}
