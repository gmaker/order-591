import { t, tn } from '../i18n.js';
import { Modal } from '../ui/Modal.js';
import { CharGenScene } from './CharGenScene.js';
import { Scene } from './Scene.js';
import { TitleScene } from './TitleScene.js';

/** Window over the frozen world when the player dies. */
export class GameOverScene extends Scene {
  /** @type {Modal} */ #modal;

  /** @param {import('./GameScene.js').GameScene} game */
  constructor(game) {
    super();
    const p = game.player;
    const depth = game.level?.depth ?? 1;
    this.#modal = new Modal({
      title: t('YOU DIED'),
      titleColor: 12,
      lines: [
        { text: t('{name} fell on floor {n}', { name: p.name, n: depth }), color: 15 },
        { text: t('level {lvl}, {gold} in the pack', { lvl: p.xpLevel, gold: tn(p.gold, 'gold') }), color: 7 },
        { text: '' },
        { text: t('The bell keeps ringing.'), color: 8 },
      ],
      buttons: [{ id: 'again', label: t('NEW GAME') }, { id: 'title', label: t('TITLE') }],
    });
  }

  get opaque() { return false; }

  update(input) {
    const choice = this.#modal.update(input);
    if (choice === 'again') this.scenes.change(new CharGenScene());
    else if (choice === 'title') this.scenes.change(new TitleScene());
  }

  render(screen, alpha) {
    this.scenes.below(this)?.render(screen, alpha);
  }

  renderUi(ui, input) {
    this.scenes.below(this)?.renderUi(ui, input);
    this.#modal.render(ui);
  }
}
