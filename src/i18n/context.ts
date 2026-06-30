import { createContext, useContext } from 'react';
import type { TranslationStrings } from './types';
import { DEFAULT_TRANSLATIONS } from './defaults';

export const TranslationContext = createContext<TranslationStrings>(DEFAULT_TRANSLATIONS);

/**
 * Hook to access the resolved TranslationStrings from context.
 * Always returns a fully-resolved object (no undefined keys).
 */
export function useTranslations(): TranslationStrings {
  return useContext(TranslationContext);
}
