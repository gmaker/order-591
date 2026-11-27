/**
 * Headless smoke test: generate every floor for a seed and let a random
 * walker play a few thousand turns on each, checking that nothing throws.
 *
 *   node tools/smoke.mjs [seed] [turnsPerFloor]
 */
import { Config } from '../src/config.js';
import { LevelGen } from '../src/game/LevelGen.js';
import { Player } from '../src/game/mob/Player.js';
import { Rng } from '../src/core/Rng.js';
import { Screen } from '../src/gfx/Screen.js';

const seed = Number(process.argv[2] ?? 591);
const turns = Number(process.argv[3] ?? 2000);
const rng = new Rng(seed ^ 0xabcdef);

/** Minimal LevelHost that records messages and ignores scene changes. */
const host = {
  messages: [],
  travelled: 0,
  won: false,
  addMessage(msg) { this.messages.push(msg); },
  pushScene() {},
  travelToFloor() { this.travelled++; },
  winGame() { this.won = true; },
};

const screen = new Screen();
let totalKills = 0;

for (let depth = 1; depth <= Config.FLOORS; depth++) {
  const t0 = performance.now();
  const level = LevelGen.generate(host, depth, seed);
  const genMs = performance.now() - t0;

  const player = new Player();
  player.hp = player.hpMax = 100000; // immortal walker
  const start = depth === 1 ? level.spawnPos : level.findStairs(-1);
  player.setPos(start);
  const squatter = level.getMob(start.x, start.y);
  if (squatter) squatter.despawn();
  level.addMob(player);
  level.lightup(player.x, player.y);

  let moved = 0;
  const killsBefore = host.messages.length;
  for (let i = 0; i < turns; i++) {
    const xa = rng.nextInt(3) - 1;
    const ya = rng.nextInt(3) - 1;
    level.clearEffects();
    player.hp = player.hpMax; // keep the walker alive whatever the deck throws at it
    if (player.attemptMove(xa, ya)) moved++;
    if (player.isDead) throw new Error(`walker died on deck ${depth} turn ${i}`);
    player.tick();
    player.nextMoveTime += 1 / player.getSpeed();
    level.tick();
    level.resetLights();
    level.lightup(player.x, player.y);
    level.display(screen, 0, 0, 29, 23, player.x, player.y);
  }
  const kills = host.messages.slice(killsBefore).filter(m => m.includes('killing') || m.includes('погибает')).length;
  totalKills += kills;

  let floor = 0;
  let seen = 0;
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (!level.isSolid(x, y)) floor++;
      if (level.isSeen(x, y)) seen++;
    }
  }
  console.log(
    `deck ${String(depth).padStart(2)}: ${level.width}x${level.height}, gen ${genMs.toFixed(1)}ms, ` +
    `floor ${floor}, seen ${seen}, stock ${level.storeItems.length}, moved ${moved}/${turns}, ` +
    `mobs ${level.mobCount}, kills ${kills}`,
  );
}

console.log(`ok: ${host.messages.length} messages, ${totalKills} kills, stairs used ${host.travelled}, won ${host.won}`);
