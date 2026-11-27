import { Faction } from './Faction.js';
import { Mob } from './Mob.js';

/** Ticks out of the player's sight before an enemy quietly despawns. */
const UNSEEN_LIMIT = 100;

/**
 * Chases the player once seen, wanders otherwise, and despawns after a while
 * out of sight so the floor keeps feeling inhabited without filling up.
 */
export class Enemy extends Mob {
  /** @type {Mob|null} */ #target = null;
  #unseenTicks = 0;

  /**
   * @param {number} x @param {number} y
   * @param {import('./EnemyTemplate.js').EnemyTemplate} template
   */
  constructor(x, y, template) {
    super();
    this.x = x;
    this.y = y;
    this.kind = template.kind;
    this.color = template.color;
    this.hp = this.hpMax = template.hp;
    this.faction = Faction.MONSTER;
    this.name = template.name;
    this.melee = template.atk;
    this.gun = 0;
    this.def = template.def;
    this.speed = template.spd;
    this.xpReward = template.xp;
  }

  tick() {
    if (this.frozen > 0) {
      this.frozen--;
      return;
    }
    super.tick();

    if (this.level.isVisible(this.x, this.y)) {
      this.#target = this.level.player;
      this.#unseenTicks = 0;
    } else if (++this.#unseenTicks >= UNSEEN_LIMIT) {
      this.despawn();
      return;
    }

    const rng = this.rng;
    let xa = rng.nextInt(3) - 1;
    let ya = rng.nextInt(3) - 1;
    const target = this.#target;
    if (target !== null) {
      xa = Math.sign(target.x - this.x);
      ya = Math.sign(target.y - this.y);
      // Slide along walls instead of pressing into a corner.
      if (this.level.isSolid(this.x + xa, this.y + ya)) {
        if (!this.level.isSolid(this.x + xa, this.y)) ya = 0;
        else if (!this.level.isSolid(this.x, this.y + ya)) xa = 0;
      }
    }
    this.attemptMove(xa, ya);
  }

  die() {
    super.die();
    this.level.dropLoot(this.x, this.y);
  }

  getAtk() { return this.gun; }
  getDef() { return this.def; }
  getMelee() { return this.melee; }
  getSpeed() { return this.speed; }
}
