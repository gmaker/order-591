import { t } from '../i18n.js';
import { Modal } from '../ui/Modal.js';
import { Scene } from './Scene.js';

/** Stat abbreviations in Player.levelUp()'s summary → readable lines. */
const STAT_NAMES = { HP: ['Health', 12], str: ['Strength', 10], dex: ['Dexterity', 10], int: ['Intellect', 10] };

/** Window over the world after using an altar. */
export class LevelUpScene extends Scene {
  /** @type {Modal} */ #modal;

  /**
   * @param {import('../game/mob/Player.js').Player} player
   * @param {string} message what changed, e.g. "HP+7, str+1"
   */
  constructor(player, message) {
    super();
    /** @type {import('../ui/Modal.js').ModalLine[]} */
    const lines = [{ text: t('You are now level {n}', { n: player.xpLevel }), color: 15 }, { text: '' }];
    for (const part of message.split(', ')) {
      const m = /^(\w+)\+(\d+)$/.exec(part);
      if (m === null) { lines.push({ text: part, color: 7 }); continue; }
      const [name, color] = STAT_NAMES[m[1]] ?? [m[1], 7];
      lines.push({ text: `${t(name)} §a+${m[2]}`, color });
    }
    lines.push({ text: t('Mana §a+2'), color: 9 });
    this.#modal = new Modal({
      title: t('LEVEL UP'),
      titleColor: 13,
      lines,
      buttons: [{ id: 'ok', label: t('CONTINUE') }],
    });
  }

  get opaque() { return false; }

  update(input) {
    if (this.#modal.update(input) !== null) this.scenes.pop();
  }

  render(screen, alpha) {
    this.scenes.below(this)?.render(screen, alpha);
  }

  renderUi(ui, input) {
    this.scenes.below(this)?.renderUi(ui, input);
    this.#modal.render(ui);
  }
}
