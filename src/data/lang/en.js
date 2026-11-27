/**
 * English. Source strings are already English, so `strings` is empty and
 * every key falls back to itself; only plurals and the long pages live here.
 * A page is a title and lines; each line starts with a palette hex digit
 * for its colour, and lines shorter than three characters are blank.
 * @type {import('../../i18n.js').Bundle}
 */
export const en = {
  id: 'en',
  name: 'English',
  plural: n => (n === 1 ? 0 : 1),
  strings: {},
  plurals: {
    gold: ['gold', 'gold'],
    arrows: ['arrow', 'arrows'],
    items: ['item', 'items'],
    turns: ['turn', 'turns'],
    targets: ['target', 'targets'],
  },
  pages: {
    intro: [
      {
        title: 'THE BELL',
        lines: [
          '7 Two hundred years ago the Order sealed the Undercroft and swore',
          '7 never to open it. Order 591 was the last one written: should the',
          '7 bell below ever ring, go down and answer it.',
          '',
          '7 Three weeks ago the bell rang. It has rung every eleven seconds',
          '7 since.',
          '',
          '7 The Order is long gone. The oath is not.',
        ],
      },
      {
        title: 'YOUR TASK',
        lines: [
          '7 You are the last to hold the oath. You go in through the well in',
          '7 the old chapter house and work your way down toward the bell,',
          '7 helping anyone you find alive.',
          '',
          'f Click where you want to go. Walk into enemies to attack.',
          'f Right-click to shoot with a bow or a staff.',
          'f Your gear and pack sit on the right; click to equip or use.',
          '',
          '7 Press ? at any time for help.',
        ],
      },
    ],
    help: [
      {
        title: 'CONTROLS',
        lines: [
          'f left click       §7= walk there; next to you: attack, open, use',
          'f right click      §7= shoot at that cell with a bow or a staff',
          'f arrows, numpad   §7= step (hjkl and yubn work too)',
          'f shift + step     §7= shoot that way',
          'f 5 / . / space    §7= wait a turn',
          'f C or Q           §7= close the doors around you',
          'f escape           §7= leave the peddler, close windows',
          'f ?                §7= this help',
          '',
          '7 Walking stops when something blocks the way, when you get hurt,',
          '7 or while an enemy is in view: with monsters around, every step',
          '7 is yours to make.',
          '',
          '7 Point at a monster to see its health above the log.',
        ],
      },
      {
        title: 'THE PANEL',
        lines: [
          '7 The right side is always yours: health, mana and experience',
          '7 bars, stats, the gear doll and the pack.',
          '',
          'f click a pack item  §7= equip it; what you wore swaps back',
          'f click worn gear    §7= take it off',
          'f right click        §7= drink, eat or drop',
          'f hover              §7= compare with what you wear',
          'f SORT               §7= order the pack by worth',
          '',
          '7 Everything you step on goes in by itself. The pack holds 24',
          '7 things; when it is full the oldest one is sold on the spot.',
          '7 Arrows and gold are not items: the bow shows your arrows.',
          '',
          '7 Peddlers stand in the walls. Walk into one: their stock opens on',
          '7 the left, click to buy; clicking your pack sells. Step away or',
          '7 press escape to finish.',
        ],
      },
      {
        title: 'FIGHTING AND MAGIC',
        lines: [
          '7 Walk into an enemy to hit it. Warriors hit hardest; rangers and',
          '7 mages are weak up close but shoot well.',
          '',
          '7 Bows spend arrows, found on the floor. Staves spend mana, which',
          '7 comes back on its own. A class wields only its own weapons.',
          '',
          'f fire    §7= a fireball that also burns the neighbours of its target',
          'f ice     §7= a shard that can freeze the target for three turns',
          'f storm   §7= lightning that jumps on to nearby enemies',
          '',
          '7 Frozen enemies stand still and glow blue. Numbers over heads are',
          '7 damage; the red ones are yours.',
        ],
      },
      {
        title: 'FLOORS AND GROWING',
        lines: [
          '7 Each floor is deeper and nastier: a courtyard, then crypts,',
          '7 caverns and the deep. The stairs down sit in wall niches.',
          '',
          '7 Experience fills the purple bar and stops at the top. Find an',
          '7 altar in a wall and walk into it to level up.',
          '',
          '7 Locked doors need a key of the same metal; keys are used up.',
          '7 Chests open when you step on them.',
          '',
          '7 Stuck? Monsters keep coming. Grind a floor for a while, buy a',
          '7 potion, come back.',
          '',
          '8 Order 591 grew out of a 48-hour jam game: the same generator,',
          '8 the same fog, nothing drawn by hand, not even the models.',
        ],
      },
    ],
    win: [
      {
        title: 'THE END',
        lines: [
          '7 After days of fighting your way down through the Undercroft,',
          '7 you reach the bell.',
          '',
          '7 It is still ringing. A weight on a chain, wound two hundred',
          '7 years ago, lets it fall every eleven seconds, exactly as',
          '7 ordered.',
          '',
          '7 There is nobody here.',
        ],
      },
    ],
  },
};
