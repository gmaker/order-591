/**
 * Headless balance table: for every floor and class, a representative
 * player (levelled by the kills the floors before gave, wearing the best
 * tier the loot budget two floors back affords) fights each enemy the floor
 * can spawn, toe to toe. Prints hits to kill, hits to die and the share of
 * hp one fight costs, so the numbers can be tuned without playing 16 floors.
 *
 *   node tools/balance.mjs [fightsPerPair]
 */
import { Config } from '../src/config.js';
import { Rng } from '../src/core/Rng.js';
import { CLASSES, RACES } from '../src/data/characters.js';
import { CATEGORIES } from '../src/data/items.js';
import { ItemSpawner } from '../src/game/item/ItemSpawner.js';
import { ENEMY_TEMPLATES } from '../src/game/mob/EnemyTemplate.js';
import { Player } from '../src/game/mob/Player.js';

const FIGHTS = Number(process.argv[2] ?? 400);
/** Kills a player racks up on one floor before taking the stairs. */
const KILLS_PER_FLOOR = 12;
const rng = new Rng(12345);
const fakeLevel = { rng, addMessage() {}, emit() {}, getTile() { return null; }, setTile() {}, removeMob() {} };

/** Same window as EnemySpawner.spawn. @param {number} depth */
function templatesAt(depth) {
  const n = ENEMY_TEMPLATES.length;
  const range = ((n / 8) | 0) + 1 + ((depth / 7) | 0);
  const offset = (((n - range) * (depth - 1)) / 15) | 0;
  const out = [];
  for (let i = 0; i < range; i++) out.push(ENEMY_TEMPLATES[Math.min(n - 1, offset + i)]);
  return out;
}

/** @param {number} depth */
function maxValue(depth) { return depth * depth + depth * 8; }

/** Best tier of a category the budget affords (the generator's ceiling). */
function bestTier(categoryId, budget) {
  const cat = /** @type {any} */ (CATEGORIES.find(c => c.id === categoryId));
  for (const t of cat.tiers) if (budget > t.value) return t;
  return cat.tiers[cat.tiers.length - 1];
}

/**
 * @param {import('../src/data/characters.js').ClassDef} job
 * @param {number} depth
 */
function makePlayer(job, depth) {
  const p = new Player();
  p.str = p.dex = p.iq = 11;
  p.hp = p.hpMax = 20;
  p.applyOrigin(RACES[0], job);
  p.level = /** @type {any} */ (fakeLevel);
  // Level from the xp of the floors before this one.
  for (let d = 1; d < depth; d++) {
    const ts = templatesAt(d);
    for (let k = 0; k < KILLS_PER_FLOOR; k++) {
      p.addXp(ts[k % ts.length].xp * 1);
      if (p.canLevelUp) p.levelUp();
    }
  }
  const spawner = new ItemSpawner(rng);
  const budget = maxValue(Math.max(1, depth - 2));
  const weaponCat = job.id === 'warrior' ? 'melee' : job.id === 'ranger' ? 'bow' : 'staff';
  // Armour is collected a piece per floor; the warrior picks up a shield later.
  const wear = [weaponCat, 'helmet', 'armor', 'greaves'].slice(0, depth);
  if (job.id === 'warrior' && depth >= 5) wear.push('shield');
  for (const cat of wear) {
    const tier = bestTier(cat, budget);
    const item = spawner.spawnNamed(depth === 1 && cat === weaponCat ? job.startWeapon : tier.name);
    item.power = tier.power; // undo the jitter
    p.addItem(item);
    p.equip(item);
  }
  p.hp = p.hpMax;
  p.mana = p.manaMax;
  p.arrows = 999;
  return p;
}

/**
 * One fight to the death, toe to toe. Ranged classes shoot; the enemy
 * attacks spd/100 times per player turn.
 * @returns {{ won: boolean, hpLost: number, playerHits: number, enemyHits: number }}
 */
function fight(job, p, template) {
  const e = template.spawn(0, 0);
  e.level = /** @type {any} */ (fakeLevel);
  p.hp = p.hpMax;
  const ranged = job.id !== 'warrior';
  let energy = 0;
  let playerHits = 0;
  let enemyHits = 0;
  for (let guard = 0; guard < 500; guard++) {
    const dmg = ranged ? p.getShootDamage(e) : p.getAttackDamage(e);
    e.hp -= dmg;
    playerHits++;
    if (e.hp <= 0) return { won: true, hpLost: p.hpMax - p.hp, playerHits, enemyHits };
    energy += e.getSpeed() / 100;
    while (energy >= 1) {
      energy -= 1;
      p.hp -= e.getAttackDamage(p);
      enemyHits++;
      if (p.hp <= 0) return { won: false, hpLost: p.hpMax, playerHits, enemyHits };
    }
  }
  return { won: false, hpLost: p.hpMax, playerHits, enemyHits };
}

const pad = (s, n) => String(s).padEnd(n);
const num = (v, n = 5) => String(Math.round(v * 10) / 10).padStart(n);

for (const job of CLASSES) {
  console.log(`\n== ${job.name} ==`);
  console.log(pad('fl', 3) + pad('lvl', 4) + pad('hp', 4) + pad('atk', 4) + pad('def', 4) + ' ' + pad('enemy', 13) + pad('hp', 4) + pad('atk', 4) + pad('def', 4) + '  hits  took  cost  win');
  for (let depth = 1; depth <= Config.FLOORS; depth++) {
    const p = makePlayer(job, depth);
    const atk = job.id === 'warrior' ? p.getMelee() : p.getAtk();
    for (const t of templatesAt(depth)) {
      let won = 0, lost = 0, hits = 0, took = 0;
      for (let i = 0; i < FIGHTS; i++) {
        const r = fight(job, p, t);
        if (r.won) won++;
        lost += r.hpLost / p.hpMax;
        hits += r.playerHits;
        took += r.enemyHits;
      }
      console.log(pad(depth, 3) + pad(p.xpLevel, 4) + pad(p.hpMax, 4) + pad(atk, 4) + pad(p.getDef(), 4) + ' '
        + pad(t.name, 13) + pad(t.hp, 4) + pad(t.atk, 4) + pad(t.def, 4)
        + num(hits / FIGHTS) + num(took / FIGHTS) + num((lost / FIGHTS) * 100, 5) + '%' + num((won / FIGHTS) * 100, 4) + '%');
    }
  }
}
