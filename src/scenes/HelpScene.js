import { pages } from '../i18n.js';
import { TextScene } from './TextScene.js';

/** In-game help, pushed on top of whatever is running when '?' is typed. */
export class HelpScene extends TextScene {
  constructor() {
    super(pages('help'), scene => scene.scenes.pop());
  }
}
