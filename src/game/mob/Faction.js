/** Who attacks whom. Walking into a mob of a hated faction is an attack. */
export const Faction = Object.freeze({
  PLAYER: 'player',
  MONSTER: 'monster',
  NEUTRAL: 'neutral',
});

/**
 * @param {string} a @param {string} b
 * @returns {boolean} whether faction a attacks faction b on contact
 */
export function hates(a, b) {
  if (a === Faction.NEUTRAL || b === Faction.NEUTRAL) return false;
  return a !== b;
}
