import { en } from './data/lang/en.js';
import { ru } from './data/lang/ru.js';

/**
 * Text lookup. Source strings in the code are English and double as keys:
 * t('You open the door') returns the current language's line, or the key
 * itself when a bundle has no entry. {name} placeholders are filled from
 * params. Counted things go through tn(), which picks the plural form.
 */

/**
 * @typedef {object} Bundle
 * @property {string} id
 * @property {string} name shown in the language switch, in its own language
 * @property {(n: number) => number} plural index of the plural form for n
 * @property {Record<string, string>} strings
 * @property {Record<string, string[]>} plurals forms per counted noun
 * @property {Record<string, Page[]>} pages intro / help / win pages
 */

/** @typedef {{ title: string, lines: string[] }} Page */

/** @type {Bundle[]} */
export const LANGUAGES = [ru, en];
const STORAGE_KEY = 'order591.lang';

let current = LANGUAGES[0];
try {
  const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
  const found = LANGUAGES.find(l => l.id === saved);
  if (found) current = found;
} catch { /* no storage: keep the default */ }

/** @returns {Bundle} */
export function language() { return current; }

/** @param {string} id */
export function setLanguage(id) {
  const found = LANGUAGES.find(l => l.id === id);
  if (!found) return;
  current = found;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}

/** Switch to the next bundle in the list. */
export function nextLanguage() {
  const i = LANGUAGES.indexOf(current);
  setLanguage(LANGUAGES[(i + 1) % LANGUAGES.length].id);
}

/**
 * @param {string} key English source string
 * @param {Record<string, string|number>} [params]
 */
export function t(key, params) {
  let s = current.strings[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
  return s;
}

/**
 * A number with its noun in the right plural form: tn(3, 'arrows').
 * @param {number} n @param {string} noun key in the bundle's plurals
 */
export function tn(n, noun) {
  const forms = current.plurals[noun] ?? en.plurals[noun] ?? [noun, noun];
  const form = forms[Math.min(forms.length - 1, current.plural(n))];
  return `${n} ${form}`;
}

/** @param {string} name intro | help | win */
export function pages(name) { return current.pages[name] ?? en.pages[name] ?? []; }
