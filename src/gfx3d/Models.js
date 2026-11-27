import { MeshBuilder } from './MeshBuilder.js';

/**
 * Every 3D model in the game, built from primitives at startup. Base colours
 * are mostly white or light grey so the per-instance tint decides the final
 * colour; models with a fixed look (blood, chest) carry their own colours.
 *
 * Mob models must stay contiguous in the order BLOB, BEAST, HUMANOID, BRUTE, BAT,
 * KNIGHT, SPIDER, matching Kind in data/creatures.js.
 */
export const Model = Object.freeze({
  FLOOR: 0,
  WALL: 1,
  DOOR_CLOSED: 2,
  DOOR_OPEN: 3,
  CHEST: 4,
  STAIRS_DOWN: 5,
  STAIRS_UP: 6,
  STATION: 7,
  BEACON: 8,
  BLOOD: 9,
  GRASS: 10,
  ITEM: 11,
  BULLET: 12,
  BULLET_HIT: 13,
  PLAYER: 14,
  BLOB: 15,
  BEAST: 16,
  HUMANOID: 17,
  BRUTE: 18,
  BAT: 19,
  KNIGHT: 20,
  SPIDER: 21,
  /** Thin wall segment from the cell centre to its +x edge; drawn per connected side. */
  WALL_ARM: 22,
  /** Player body without the hat, with hair: the female variant. */
  PLAYER_F: 23,
  TREE: 24,
  MUSHROOM: 25,
  CRYSTAL: 26,
  BONES: 27,
  /** Projectiles, all pointing along +x and centred on y = 0. */
  ARROW: 28,
  ORB: 29,
  SHARD: 30,
  /** One lightning segment from x = 0 to x = 1; scale x to the length. */
  BOLT: 31,
  /** Two more grass patches so neighbouring cells do not repeat. */
  GRASS2: 32,
  GRASS3: 33,
  COUNT: 34,
});

/** Grass patch variants; pick by a per-cell hash. */
export const GRASS_VARIANTS = [Model.GRASS, Model.GRASS2, Model.GRASS3];

export const WALL_HEIGHT = 0.8;
const WALL_THICK = 0.22;

const WHITE = /** @type {[number, number, number]} */ ([1, 1, 1]);
const GREY = /** @type {[number, number, number]} */ ([0.8, 0.8, 0.8]);
const DARK = /** @type {[number, number, number]} */ ([0.55, 0.55, 0.55]);

/** @returns {import('./MeshBuilder.js').MeshData[]} indexed by Model */
export function buildModels() {
  const models = new Array(Model.COUNT);

  models[Model.FLOOR] = new MeshBuilder().quad(1, 1, WHITE).build();
  // Walls are thin: a post at the cell centre plus one arm per connected neighbour.
  models[Model.WALL] = new MeshBuilder()
    .box(WALL_THICK + 0.06, WALL_HEIGHT, WALL_THICK + 0.06, WHITE)
    .box(WALL_THICK + 0.14, 0.08, WALL_THICK + 0.14, GREY, { y: WALL_HEIGHT })
    .build();
  models[Model.WALL_ARM] = new MeshBuilder()
    .box(0.5, WALL_HEIGHT - 0.06, WALL_THICK, WHITE, { x: 0.25 })
    .box(0.5, 0.06, WALL_THICK + 0.08, GREY, { x: 0.25, y: WALL_HEIGHT - 0.06 })
    .build();

  models[Model.DOOR_CLOSED] = new MeshBuilder()
    .box(1, 0.95, 0.16, WHITE)
    .box(0.12, 0.12, 0.2, DARK, { x: 0.28, y: 0.45 })
    .build();
  models[Model.DOOR_OPEN] = new MeshBuilder()
    .box(0.18, 0.95, 0.16, WHITE, { x: -0.41 })
    .box(0.18, 0.95, 0.16, WHITE, { x: 0.41 })
    .build();

  models[Model.CHEST] = new MeshBuilder()
    .box(0.62, 0.3, 0.42, [0.55, 0.36, 0.2])
    .box(0.66, 0.16, 0.46, [0.42, 0.27, 0.15], { y: 0.3 })
    .box(0.1, 0.1, 0.06, [0.9, 0.8, 0.3], { y: 0.26, z: 0.22 })
    .build();

  {
    const b = new MeshBuilder();
    b.quad(0.96, 0.96, [0.08, 0.08, 0.1], { y: 0.005 });
    for (let i = 0; i < 3; i++) b.box(0.9, 0.08, 0.2, GREY, { y: 0.24 - i * 0.08, z: -0.3 + i * 0.3 });
    models[Model.STAIRS_DOWN] = b.build();
  }
  {
    const b = new MeshBuilder();
    for (let i = 0; i < 3; i++) b.box(0.9, 0.12 + i * 0.12, 0.3, GREY, { z: 0.3 - i * 0.3 });
    models[Model.STAIRS_UP] = b.build();
  }

  models[Model.STATION] = new MeshBuilder()
    .box(0.7, 0.9, 0.5, GREY)
    .box(0.5, 0.25, 0.08, WHITE, { y: 0.5, z: 0.28 })
    .build();

  models[Model.BEACON] = new MeshBuilder()
    .cylinder(0.3, 0.2, 8, DARK)
    .cylinder(0.08, 1.2, 6, GREY, { y: 0.2 })
    .sphere(0.18, 8, WHITE, { y: 1.3 })
    .build();

  models[Model.BLOOD] = new MeshBuilder()
    .quad(0.5, 0.5, [0.45, 0.05, 0.05], { y: 0.01 })
    .quad(0.25, 0.25, [0.45, 0.05, 0.05], { y: 0.012, x: 0.3, z: 0.2 })
    .quad(0.18, 0.18, [0.45, 0.05, 0.05], { y: 0.012, x: -0.25, z: -0.28 })
    .build();

  // Grass: a cell-sized patch of pointed blades, three variants. Heights are
  // around 0.35 so a per-instance y scale of 0.5..1.5 covers lawn to meadow.
  GRASS_VARIANTS.forEach((id, variant) => {
    const b = new MeshBuilder();
    let seed = 0x9e37 + variant * 7919;
    const rand = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 22; i++) {
      const shade = 0.85 + rand() * 0.3;
      b.blade(0.06 + rand() * 0.05, 0.26 + rand() * 0.2,
        [0.42 * shade, 0.48 * shade, 0.36 * shade], [1.02 * shade, 1.05 * shade, 0.9 * shade], {
          x: (rand() - 0.5) * 0.96, z: (rand() - 0.5) * 0.96, yaw: rand() * Math.PI,
          lean: [(rand() - 0.5) * 0.16, (rand() - 0.5) * 0.16],
        });
    }
    models[id] = b.build();
  });

  models[Model.ITEM] = new MeshBuilder()
    .cylinder(0.16, 0.16, 4, WHITE, { y: 0.16, rTop: 0 })
    .cylinder(0.001, 0.16, 4, WHITE, { y: 0, rTop: 0.16 })
    .build();

  models[Model.BULLET] = new MeshBuilder().sphere(0.08, 6, WHITE, { y: 0.45 }).build();
  models[Model.BULLET_HIT] = new MeshBuilder()
    .box(0.3, 0.3, 0.3, WHITE, { y: 0.35 })
    .build();

  // ── Mobs ─────────────────────────────────────────────────────────────────

  models[Model.PLAYER] = new MeshBuilder()
    .cylinder(0.2, 0.42, 8, WHITE)
    .sphere(0.2, 8, [0.95, 0.85, 0.75], { y: 0.44 })
    .cylinder(0.22, 0.14, 8, WHITE, { y: 0.76, rTop: 0.1 })
    .build();
  models[Model.PLAYER_F] = new MeshBuilder()
    .cylinder(0.17, 0.44, 8, WHITE, { rTop: 0.14 })
    .sphere(0.19, 8, [0.95, 0.85, 0.75], { y: 0.46 })
    .sphere(0.21, 8, [0.3, 0.2, 0.12], { y: 0.56, squash: 0.6 })
    .box(0.3, 0.22, 0.14, [0.3, 0.2, 0.12], { y: 0.5, z: -0.14 })
    .build();

  models[Model.BLOB] = new MeshBuilder()
    .sphere(0.32, 8, WHITE, { squash: 0.7 })
    .build();

  models[Model.BEAST] = new MeshBuilder()
    .box(0.42, 0.22, 0.24, WHITE, { y: 0.02 })
    .cylinder(0.11, 0.2, 6, WHITE, { x: 0.3, y: 0.08, rTop: 0 })
    .box(0.3, 0.04, 0.04, DARK, { x: -0.34, y: 0.1 })
    .build();

  models[Model.HUMANOID] = new MeshBuilder()
    .cylinder(0.2, 0.4, 8, WHITE)
    .box(0.32, 0.2, 0.3, GREY, { y: 0.42 })
    .box(0.1, 0.06, 0.06, [1, 0.3, 0.3], { y: 0.5, z: 0.17 })
    .build();

  models[Model.BRUTE] = new MeshBuilder()
    .box(0.5, 0.5, 0.4, WHITE, { y: 0.12 })
    .box(0.34, 0.26, 0.3, GREY, { y: 0.64 })
    .box(0.12, 0.14, 0.14, DARK, { x: -0.18 })
    .box(0.12, 0.14, 0.14, DARK, { x: 0.18 })
    .build();

  models[Model.BAT] = new MeshBuilder()
    .sphere(0.12, 6, WHITE, { y: 0.5 })
    .box(0.3, 0.03, 0.16, WHITE, { x: -0.22, y: 0.58 })
    .box(0.3, 0.03, 0.16, WHITE, { x: 0.22, y: 0.58 })
    .build();

  models[Model.KNIGHT] = new MeshBuilder()
    .cylinder(0.18, 0.44, 8, WHITE)
    .sphere(0.17, 8, [0.95, 0.85, 0.75], { y: 0.46 })
    .build();

  {
    const b = new MeshBuilder();
    b.sphere(0.22, 8, WHITE, { y: 0.1, squash: 0.8 });
    for (let i = 0; i < 4; i++) {
      const yaw = (i / 4) * Math.PI + Math.PI / 8;
      b.vquad(0.7, 0.04, DARK, { y: 0.2, yaw });
    }
    models[Model.SPIDER] = b.build();
  }

  // ── Biome dressing ───────────────────────────────────────────────────────

  models[Model.TREE] = new MeshBuilder()
    .cylinder(0.12, 0.5, 6, [0.42, 0.3, 0.18])
    .cylinder(0.52, 0.7, 7, WHITE, { y: 0.4, rTop: 0, sway: true })
    .cylinder(0.38, 0.6, 7, WHITE, { y: 0.85, rTop: 0, sway: true })
    .build();
  models[Model.MUSHROOM] = new MeshBuilder()
    .cylinder(0.05, 0.16, 5, [0.85, 0.8, 0.7], { x: 0.15, z: 0.1 })
    .sphere(0.12, 6, WHITE, { x: 0.15, y: 0.12, z: 0.1, squash: 0.5 })
    .cylinder(0.04, 0.11, 5, [0.85, 0.8, 0.7], { x: -0.18, z: -0.12 })
    .sphere(0.09, 6, WHITE, { x: -0.18, y: 0.08, z: -0.12, squash: 0.5 })
    .build();
  models[Model.CRYSTAL] = new MeshBuilder()
    .cylinder(0.14, 0.55, 5, WHITE, { rTop: 0, x: 0.08 })
    .cylinder(0.09, 0.32, 5, WHITE, { rTop: 0, x: -0.16, z: 0.12 })
    .build();
  models[Model.BONES] = new MeshBuilder()
    .box(0.4, 0.05, 0.06, [0.85, 0.82, 0.72], { x: 0.05, z: 0.1 })
    .box(0.06, 0.05, 0.3, [0.85, 0.82, 0.72], { x: -0.2, z: -0.1 })
    .sphere(0.09, 6, [0.85, 0.82, 0.72], { x: 0.2, z: -0.2 })
    .build();

  // ── Projectiles ─────────────────────────────────────────────────────────

  models[Model.ARROW] = new MeshBuilder()
    .box(0.7, 0.06, 0.06, [0.62, 0.46, 0.26], { y: -0.03 })
    .box(0.14, 0.1, 0.1, [0.85, 0.85, 0.9], { x: 0.4, y: -0.05 })
    .box(0.18, 0.16, 0.02, [0.9, 0.3, 0.3], { x: -0.3, y: -0.08 })
    .box(0.18, 0.02, 0.16, [0.9, 0.3, 0.3], { x: -0.3, y: -0.01 })
    .build();
  models[Model.ORB] = new MeshBuilder()
    .sphere(0.2, 8, WHITE, { y: -0.2 })
    .build();
  models[Model.SHARD] = new MeshBuilder()
    .box(0.28, 0.18, 0.18, WHITE, { x: -0.1, y: -0.09 })
    .box(0.24, 0.11, 0.11, WHITE, { x: 0.15, y: -0.055 })
    .box(0.16, 0.05, 0.05, WHITE, { x: 0.34, y: -0.025 })
    .build();
  models[Model.BOLT] = new MeshBuilder()
    .box(1, 0.07, 0.07, WHITE, { x: 0.5, y: -0.035 })
    .build();

  return models;
}
