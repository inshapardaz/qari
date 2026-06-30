/**
 * Property 5: Provider registration order and priority
 *
 * For any combination of Hunspell dictionary configs, user-supplied providers,
 * and built-in flag, the DictionaryService SHALL register providers in the order:
 * Hunspell providers first, then user-supplied providers, then built-in online providers.
 * When multiple providers support the same language, lookups SHALL always be routed
 * to the first provider in registration order that supports the requested language.
 *
 * **Validates: Requirements 3.2, 3.4, 7.4, 7.5, 10.3**
 *
 * Feature: language-dictionaries, Property 5: Provider registration order and priority
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { DictionaryService } from '../dictionary-service';
import { DictionaryProvider, DictionaryResult } from '../../interfaces/dictionary';

/**
 * Helper: create a mock DictionaryProvider that tracks whether it was called.
 */
function createMockProvider(
  id: string,
  supportedLanguages: string[],
  category: 'local' | 'online'
): DictionaryProvider & { lookupCalled: boolean } {
  const provider: DictionaryProvider & { lookupCalled: boolean } = {
    id,
    supportedLanguages,
    category,
    ready: true,
    lookupCalled: false,
    lookup: vi.fn(async (word: string, language: string): Promise<DictionaryResult> => {
      provider.lookupCalled = true;
      return {
        word,
        language,
        definitions: [{ meaning: `Definition from ${id}` }],
        spellCheck: category === 'local' ? { correct: true, suggestions: [] } : undefined,
      };
    }),
  };
  return provider;
}

/** Arbitrary for generating a language code */
const languageArb = fc.constantFrom('en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ar', 'zh', 'ja');

/** Arbitrary for generating a list of supported languages (1-4 languages) */
const languageListArb = fc.uniqueArray(languageArb, { minLength: 1, maxLength: 4 });

describe('Feature: language-dictionaries, Property 5: Provider registration order and priority', () => {
  it('local providers are queried before online providers for the same language', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArb,
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        async (language, numLocal, numOnline) => {
          const service = new DictionaryService();

          // Create local providers that all support the target language
          const localProviders = Array.from({ length: numLocal }, (_, i) =>
            createMockProvider(`local-${i}`, [language], 'local')
          );

          // Create online providers that all support the target language
          const onlineProviders = Array.from({ length: numOnline }, (_, i) =>
            createMockProvider(`online-${i}`, [language], 'online')
          );

          // Register in order: local first, then online
          for (const p of localProviders) {
            service.registerProvider(p, 'local');
          }
          for (const p of onlineProviders) {
            service.registerProvider(p, 'online');
          }

          await service.lookup('testword', language, 'some context text with testword in it', 30);

          // The first local provider should have been called
          expect(localProviders[0].lookup).toHaveBeenCalled();

          // Online providers should NOT have been called (local succeeded)
          for (const p of onlineProviders) {
            expect(p.lookup).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('among same-category providers, the first registered wins for a given language', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArb,
        fc.integer({ min: 2, max: 5 }),
        fc.constantFrom('local' as const, 'online' as const),
        async (language, numProviders, category) => {
          const service = new DictionaryService();

          // Create multiple providers of the same category supporting the same language
          const providers = Array.from({ length: numProviders }, (_, i) =>
            createMockProvider(`provider-${category}-${i}`, [language], category)
          );

          // Register all in order
          for (const p of providers) {
            service.registerProvider(p, category);
          }

          await service.lookup('hello', language, 'text with hello in it', 10);

          // Only the first provider should be called
          expect(providers[0].lookup).toHaveBeenCalled();

          // Subsequent providers of same category should NOT be called
          for (let i = 1; i < providers.length; i++) {
            expect(providers[i].lookup).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('registration order respects Hunspell → user-supplied → built-in online sequence', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArb,
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        async (language, numHunspell, numUser, numBuiltIn) => {
          const service = new DictionaryService();

          // Simulate registration order as described in design:
          // Hunspell (local) → user-supplied (online) → built-in online
          const hunspellProviders = Array.from({ length: numHunspell }, (_, i) =>
            createMockProvider(`hunspell-${i}`, [language], 'local')
          );
          const userProviders = Array.from({ length: numUser }, (_, i) =>
            createMockProvider(`user-${i}`, [language], 'online')
          );
          const builtInProviders = Array.from({ length: numBuiltIn }, (_, i) =>
            createMockProvider(`builtin-${i}`, [language], 'online')
          );

          // Register in the defined priority order
          for (const p of hunspellProviders) {
            service.registerProvider(p, 'local');
          }
          for (const p of userProviders) {
            service.registerProvider(p, 'online');
          }
          for (const p of builtInProviders) {
            service.registerProvider(p, 'online');
          }

          await service.lookup('word', language, 'a text with word in it', 12);

          // Hunspell (local) should be called first due to local-first routing
          expect(hunspellProviders[0].lookup).toHaveBeenCalled();

          // User-supplied online should NOT be called (local succeeded)
          for (const p of userProviders) {
            expect(p.lookup).not.toHaveBeenCalled();
          }

          // Built-in online should NOT be called (local succeeded)
          for (const p of builtInProviders) {
            expect(p.lookup).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when no local provider supports the language, first online provider in registration order is used', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArb,
        languageArb.filter((l) => l !== 'en'), // ensure local supports a DIFFERENT language
        fc.integer({ min: 2, max: 4 }),
        async (targetLang, otherLang, numOnline) => {
          // Skip if targetLang and otherLang are the same
          fc.pre(targetLang !== otherLang);

          const service = new DictionaryService();

          // Local provider supports a different language (won't match)
          const localProvider = createMockProvider('local-other', [otherLang], 'local');
          service.registerProvider(localProvider, 'local');

          // Multiple online providers support the target language
          const onlineProviders = Array.from({ length: numOnline }, (_, i) =>
            createMockProvider(`online-${i}`, [targetLang], 'online')
          );
          for (const p of onlineProviders) {
            service.registerProvider(p, 'online');
          }

          await service.lookup('word', targetLang, 'context with word here', 13);

          // Local should NOT be called (doesn't support target language)
          expect(localProvider.lookup).not.toHaveBeenCalled();

          // First online provider should be called
          expect(onlineProviders[0].lookup).toHaveBeenCalled();

          // Subsequent online providers should NOT be called
          for (let i = 1; i < onlineProviders.length; i++) {
            expect(onlineProviders[i].lookup).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('user-supplied online providers take priority over built-in online providers', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArb,
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        async (language, numUser, numBuiltIn) => {
          const service = new DictionaryService();

          // No local providers — just user-supplied and built-in online
          const userProviders = Array.from({ length: numUser }, (_, i) =>
            createMockProvider(`user-online-${i}`, [language], 'online')
          );
          const builtInProviders = Array.from({ length: numBuiltIn }, (_, i) =>
            createMockProvider(`builtin-online-${i}`, [language], 'online')
          );

          // Register user-supplied first, then built-in (as per design)
          for (const p of userProviders) {
            service.registerProvider(p, 'online');
          }
          for (const p of builtInProviders) {
            service.registerProvider(p, 'online');
          }

          await service.lookup('test', language, 'text with test word', 10);

          // First user-supplied provider should be called
          expect(userProviders[0].lookup).toHaveBeenCalled();

          // Built-in providers should NOT be called
          for (const p of builtInProviders) {
            expect(p.lookup).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
