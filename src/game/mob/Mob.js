import { G } from '../../gfx/Atlas.js';
import { t } from '../../i18n.js';
import { Tiles } from '../tile/Tiles.js';
import { Faction, hates } from './Faction.js';

/**
 * Base class for the player and enemies. Movement is "attempt to step into a
 * cell": if a hated mob is there, that is an attack; if a tile reacts (door,
 * chest, stairs), the tile decides what happens.
 */
export class Mob {
  hp = 1;
  hpMax = 1;
  xpReward = 0;
  x = 0;
  y = 0;
  /** @type {import('../Level.js').Level} assigned by Level.addMob */
  level = /** @type {any} */ (null);
  /** Body shape, one of data/creatures.js Kind (ignored for the player). */
  kind = 0;
  glyph = G.SPACE;
  color = 15;
  isDead = false;
  /** Turns left standing still after an ice shard. */
  frozen = 0;
  faction = Faction.NEUTRAL;
  name = 'a mob';

  healTick = 0;
  /** Ticks between one point of natural regeneration. */
  healInterval = 5;
  /** Scheduler time of this mob's next action. */
  nextMoveTime = 0;

  /** @type {import('../../core/Rng.js').Rng} */
  get rng() { return this.level.rng; }

  /**
   * @param {number} xa @param {number} ya
   * @returns {boolean} whether the mob actually moved
   */
  attemptMove(xa, ya) {
    if (this.level.tryMove(this, this.x + xa, this.y + ya)) {
      this.level.moveMob(this, this.x + xa, this.y + ya);
      this.x += xa;
      this.y += ya;
      return true;
    }
    return false;
  }

  tick() {
    this.healTick++;
    if (this.healTick >= this.healInterval) {
      this.healTick = 0;
      if (this.hp < this.hpMax) this.hp++;
    }
  }

  /** @param {import('../Pos.js').Pos} pos */
  setPos(pos) {
    this.x = pos.x;
    this.y = pos.y;
  }

  /** Remove from the level without any death side effects. */
  despawn() {
    this.isDead = true;
    this.level.removeMob(this);
  }

  die() {
    this.despawn();
  }

  /** @param {Mob} target */
  getAttackDamage(target) {
    return this.#damage(this.getMelee(), target);
  }

  /** @param {Mob} target */
  getShootDamage(target) {
    return this.#damage(this.getAtk(), target);
  }

  /**
   * @param {number} attackValue
   * @param {Mob} target
   */
  #damage(attackValue, target) {
    const rng = this.rng;
    const half = (attackValue / 2) | 0;
    const attack = attackValue + rng.nextInt(half) - rng.nextInt(half);
    const def = ((rng.nextInt(target.getDef()) + rng.nextInt(target.getDef())) / 2) | 0;
    return Math.max(0, attack - def);
  }

  /**
   * Another mob tried to step into this one.
   * @param {Mob} source
   * @returns {boolean} always false: nobody moves
   */
  tryMove(source) {
    if (hates(source.faction, this.faction)) {
      this.level.emit('attack', { source, target: this });
      this.hurt(source, source.getAttackDamage(this));
    }
    return false;
  }

  /**
   * @param {Mob} source
   * @param {number} [scale] damage multiplier (splash, chain hops)
   */
  shoot(source, scale = 1) {
    this.hurt(source, Math.round(source.getShootDamage(this) * scale));
  }

  /**
   * Lose the next few turns.
   * @param {number} turns
   */
  freeze(turns) {
    if (this.isDead) return;
    this.frozen = Math.max(this.frozen, turns);
    this.level.addMessage(t('{name} §bfreezes solid', { name: this.getName() }));
    this.level.emit('freeze', { target: this });
  }

  /**
   * @param {Mob} source
   * @param {number} damage
   */
  hurt(source, damage) {
    const level = this.level;
    if (damage === 0) {
      level.addMessage(source.isPlayer ? t('You §8miss') : t('{name} §8misses', { name: source.getName() }));
      level.emit('miss', { source, target: this });
      return;
    }
    let msg = source.isPlayer
      ? t('You hit for §c{dmg}§7 damage', { dmg: damage })
      : t('{name} hits for §4{dmg}§7 damage', { name: source.getName(), dmg: damage });
    this.hp -= damage;
    level.emit('hit', { source, target: this, damage });
    if (this.hp <= 0) {
      level.emit('death', { mob: this, source });
      this.die();
      if (level.getTile(this.x, this.y) === Tiles.floor) level.setTile(this.x, this.y, Tiles.blood);
      msg += t(', killing {name}', { name: this.getName() });
    }
    level.addMessage(msg);
    if (this.isDead) source.kill(this);
  }

  /**
   * Called on the attacker when it kills something.
   * @param {Mob} victim
   */
  kill(victim) {}

  get isPlayer() { return false; }

  /** Display name in the current language. */
  getName() { return t(this.name); }

  /** Melee attack value. */
  getMelee() { return 0; }
  /** Ranged attack value. */
  getAtk() { return 0; }
  getDef() { return 1; }
  /** Actions per 100 scheduler units. */
  getSpeed() { return 100; }
}
