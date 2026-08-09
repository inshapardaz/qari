import { en } from './en';
import { ur } from './ur';
import { fr } from './fr';

export { en, ur, fr };

/** Built-in complete locales, keyed by language code. */
export const LOCALES = { en, ur, fr };

export type LocaleCode = keyof typeof LOCALES;
