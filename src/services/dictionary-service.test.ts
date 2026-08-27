import { describe, it, expect, vi } from 'vitest';
import { DictionaryService } from './dictionary-service';
import { DictionaryProvider, DictionaryResult } from '../interfaces/dictionary';

function createMockProvider(
  id: string,
  languages: string[],
  lookupFn?: (word: string, language: string, context: string) => Promise<DictionaryResult>
): DictionaryProvider {
  return {
    id,
    supportedLanguages: languages,
    lookup: lookupFn ?? (async (word, language) => ({
      word,
      language,
      definitions: [
        { meaning: `Definition of ${word}`, partOfSpeech: 'noun', examples: [`Example with ${word}`] },
      ],
    })),
  };
}

describe('DictionaryService', () => {
  describe('registerProvider', () => {
    it('should register a provider', () => {
      const service = new DictionaryService();
      const provider = createMockProvider('english-dict', ['en']);
      service.registerProvider(provider);

      // Verify it works by performing a lookup
      return expect(service.lookup('hello', 'en', 'say hello world', 4)).resolves.toMatchObject({
        word: 'hello',
        language: 'en',
      });
    });

    it('should support registering multiple providers', async () => {
      const service = new DictionaryService();
      service.registerProvider(createMockProvider('en-dict', ['en']));
      service.registerProvider(createMockProvider('ur-dict', ['ur']));

      const enResult = await service.lookup('hello', 'en', 'hello world', 0);
      expect(enResult.notFound).toBeUndefined();

      const urResult = await service.lookup('سلام', 'ur', 'سلام دنیا', 0);
      expect(urResult.notFound).toBeUndefined();
    });
  });

  describe('provider routing', () => {
    it('should route to provider matching the language', async () => {
      const service = new DictionaryService();
      const enProvider = createMockProvider('en-dict', ['en'], async (word) => ({
        word,
        language: 'en',
        definitions: [{ meaning: 'English definition' }],
      }));
      const frProvider = createMockProvider('fr-dict', ['fr'], async (word) => ({
        word,
        language: 'fr',
        definitions: [{ meaning: 'Définition française' }],
      }));

      service.registerProvider(enProvider);
      service.registerProvider(frProvider);

      const result = await service.lookup('bonjour', 'fr', 'bonjour monde', 0);
      expect(result.definitions[0].meaning).toBe('Définition française');
    });

    it('should use the first registered provider when multiple match', async () => {
      const service = new DictionaryService();
      const firstProvider = createMockProvider('first', ['en'], async (word) => ({
        word,
        language: 'en',
        definitions: [{ meaning: 'first provider' }],
      }));
      const secondProvider = createMockProvider('second', ['en'], async (word) => ({
        word,
        language: 'en',
        definitions: [{ meaning: 'second provider' }],
      }));

      service.registerProvider(firstProvider);
      service.registerProvider(secondProvider);

      const result = await service.lookup('test', 'en', 'test text', 0);
      expect(result.definitions[0].meaning).toBe('first provider');
    });
  });

  describe('multiple local dictionaries for the same language', () => {
    function createLocalProvider(
      id: string,
      lookupFn: (word: string) => Promise<DictionaryResult>
    ): DictionaryProvider {
      return {
        id,
        supportedLanguages: ['en'],
        category: 'local',
        ready: true,
        lookup: async (word) => lookupFn(word),
      };
    }

    it('merges definitions from every local provider that finds the word', async () => {
      const service = new DictionaryService();
      service.registerProvider(
        createLocalProvider('dict-a', async (word) => ({
          word,
          language: 'en',
          definitions: [{ meaning: 'meaning from dict A' }],
        })),
        'local'
      );
      service.registerProvider(
        createLocalProvider('dict-b', async (word) => ({
          word,
          language: 'en',
          definitions: [{ meaning: 'meaning from dict B' }],
        })),
        'local'
      );

      const result = await service.lookup('word', 'en', 'a word here', 2);

      expect(result.notFound).toBe(false);
      expect(result.definitions).toEqual([
        { meaning: 'meaning from dict A', source: 'dict-a' },
        { meaning: 'meaning from dict B', source: 'dict-b' },
      ]);
    });

    it('skips local providers that report notFound and still uses the others', async () => {
      const service = new DictionaryService();
      service.registerProvider(
        createLocalProvider('dict-a', async (word) => ({
          word,
          language: 'en',
          definitions: [],
          notFound: true,
        })),
        'local'
      );
      service.registerProvider(
        createLocalProvider('dict-b', async (word) => ({
          word,
          language: 'en',
          definitions: [{ meaning: 'found in dict B' }],
        })),
        'local'
      );

      const result = await service.lookup('word', 'en', 'a word here', 2);

      expect(result.notFound).toBe(false);
      expect(result.definitions).toEqual([{ meaning: 'found in dict B', source: 'dict-b' }]);
    });

    it('continues to the next local provider when one throws', async () => {
      const service = new DictionaryService();
      service.registerProvider(
        createLocalProvider('dict-a', async () => {
          throw new Error('dict A failed');
        }),
        'local'
      );
      service.registerProvider(
        createLocalProvider('dict-b', async (word) => ({
          word,
          language: 'en',
          definitions: [{ meaning: 'found in dict B' }],
        })),
        'local'
      );

      const result = await service.lookup('word', 'en', 'a word here', 2);

      expect(result.definitions).toEqual([{ meaning: 'found in dict B', source: 'dict-b' }]);
    });

    it('returns notFound when no local provider finds the word and there is no online fallback', async () => {
      const service = new DictionaryService();
      service.registerProvider(
        createLocalProvider('dict-a', async (word) => ({
          word,
          language: 'en',
          definitions: [],
          notFound: true,
        })),
        'local'
      );
      service.registerProvider(
        createLocalProvider('dict-b', async (word) => ({
          word,
          language: 'en',
          definitions: [],
          notFound: true,
        })),
        'local'
      );

      const result = await service.lookup('word', 'en', 'a word here', 2);

      expect(result.notFound).toBe(true);
    });

    it('a misspelling reported by any local provider short-circuits the rest', async () => {
      const service = new DictionaryService();
      const secondLookup = vi.fn(async (word: string) => ({
        word,
        language: 'en',
        definitions: [{ meaning: 'should not be reached' }],
      }));
      service.registerProvider(
        createLocalProvider('spellchecker', async (word) => ({
          word,
          language: 'en',
          definitions: [],
          spellCheck: { correct: false, suggestions: ['worm', 'ward'] },
        })),
        'local'
      );
      service.registerProvider(
        { id: 'dict-b', supportedLanguages: ['en'], category: 'local', ready: true, lookup: secondLookup },
        'local'
      );

      const result = await service.lookup('wrod', 'en', 'a wrod here', 2);

      expect(result.spellCheck).toEqual({ correct: false, suggestions: ['worm', 'ward'] });
      expect(secondLookup).not.toHaveBeenCalled();
    });

    it('merges a correct-spelling local provider with a plain local dictionary\'s definition', async () => {
      const service = new DictionaryService();
      service.registerProvider(
        createLocalProvider('spellchecker', async (word) => ({
          word,
          language: 'en',
          definitions: [],
          spellCheck: { correct: true, suggestions: [] },
        })),
        'local'
      );
      service.registerProvider(
        createLocalProvider('dict-b', async (word) => ({
          word,
          language: 'en',
          definitions: [{ meaning: 'a real definition' }],
        })),
        'local'
      );

      const result = await service.lookup('word', 'en', 'a word here', 2);

      expect(result.spellCheck).toEqual({ correct: true, suggestions: [] });
      expect(result.definitions).toEqual([{ meaning: 'a real definition', source: 'dict-b' }]);
    });
  });

  describe('context extraction', () => {
    it('should extract up to 200 characters before and after the word', () => {
      const service = new DictionaryService();
      const text = 'a'.repeat(300) + 'WORD' + 'b'.repeat(300);
      const wordPosition = 300;

      const context = service.extractContext(text, wordPosition, 4);
      // Should get 200 chars before + 4 char word + 200 chars after = 404
      expect(context.length).toBe(404);
      expect(context.startsWith('a'.repeat(200))).toBe(true);
      expect(context.endsWith('b'.repeat(200))).toBe(true);
      expect(context).toContain('WORD');
    });

    it('should bound by text start', () => {
      const service = new DictionaryService();
      const text = 'hello world';
      const wordPosition = 0;

      const context = service.extractContext(text, wordPosition, 5);
      expect(context).toBe('hello world');
    });

    it('should bound by text end', () => {
      const service = new DictionaryService();
      const text = 'hello world';
      const wordPosition = 6;

      const context = service.extractContext(text, wordPosition, 5);
      expect(context).toBe('hello world');
    });

    it('should handle word at the very end of text', () => {
      const service = new DictionaryService();
      const text = 'some text here';
      const wordPosition = 10;

      const context = service.extractContext(text, wordPosition, 4);
      expect(context).toBe('some text here');
    });

    it('should pass extracted context to the provider', async () => {
      const service = new DictionaryService();
      let receivedContext = '';
      const provider = createMockProvider('en-dict', ['en'], async (word, lang, context) => {
        receivedContext = context;
        return { word, language: lang, definitions: [{ meaning: 'test' }] };
      });
      service.registerProvider(provider);

      const text = 'a'.repeat(300) + 'hello' + 'b'.repeat(300);
      await service.lookup('hello', 'en', text, 300);

      // Context should be 200 before + 5 word + 200 after
      expect(receivedContext.length).toBe(405);
      expect(receivedContext.startsWith('a'.repeat(200))).toBe(true);
      expect(receivedContext.endsWith('b'.repeat(200))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return notFound when provider returns notFound', async () => {
      const service = new DictionaryService();
      const provider = createMockProvider('en-dict', ['en'], async (word) => ({
        word,
        language: 'en',
        definitions: [],
        notFound: true,
      }));
      service.registerProvider(provider);

      const result = await service.lookup('xyzzy', 'en', 'the xyzzy word', 4);
      expect(result.notFound).toBe(true);
    });

    it('should return notFound with message when provider throws', async () => {
      const service = new DictionaryService();
      const provider = createMockProvider('en-dict', ['en'], async () => {
        throw new Error('Network error');
      });
      service.registerProvider(provider);

      const result = await service.lookup('hello', 'en', 'hello world', 0);
      expect(result.notFound).toBe(true);
      expect(result.definitions[0].meaning).toContain('lookup failed');
    });

    it('should return no dictionary message when no provider for language', async () => {
      const service = new DictionaryService();
      service.registerProvider(createMockProvider('en-dict', ['en']));

      const result = await service.lookup('mot', 'fr', 'un mot ici', 3);
      expect(result.notFound).toBe(true);
      expect(result.definitions[0].meaning).toContain('No dictionary available for fr');
    });

    it('should offer fallback language when default provider exists', async () => {
      const service = new DictionaryService();
      service.registerProvider(createMockProvider('en-dict', ['en']));
      service.setDefaultLanguage('en');

      const result = await service.lookup('mot', 'fr', 'un mot ici', 3);
      expect(result.notFound).toBe(true);
      expect(result.fallbackLanguage).toBe('en');
    });

    it('should not offer fallback when no default language is set', async () => {
      const service = new DictionaryService();
      service.registerProvider(createMockProvider('en-dict', ['en']));

      const result = await service.lookup('mot', 'fr', 'un mot ici', 3);
      expect(result.notFound).toBe(true);
      expect(result.fallbackLanguage).toBeUndefined();
    });

    it('should not offer fallback when default language equals requested language', async () => {
      const service = new DictionaryService();
      service.setDefaultLanguage('fr');

      const result = await service.lookup('mot', 'fr', 'un mot ici', 3);
      expect(result.notFound).toBe(true);
      expect(result.fallbackLanguage).toBeUndefined();
    });
  });

  describe('full lookup flow', () => {
    it('should return complete DictionaryResult with definitions, part of speech, examples', async () => {
      const service = new DictionaryService();
      const provider = createMockProvider('en-dict', ['en'], async (word) => ({
        word,
        language: 'en',
        definitions: [
          { meaning: 'a greeting', partOfSpeech: 'interjection', examples: ['Hello, world!'] },
          { meaning: 'to say hello', partOfSpeech: 'verb', examples: ['She helloed from across the room.'] },
        ],
      }));
      service.registerProvider(provider);

      const result = await service.lookup('hello', 'en', 'say hello world', 4);
      expect(result.word).toBe('hello');
      expect(result.language).toBe('en');
      expect(result.definitions).toHaveLength(2);
      expect(result.definitions[0].partOfSpeech).toBe('interjection');
      expect(result.definitions[0].examples).toContain('Hello, world!');
      expect(result.definitions[1].partOfSpeech).toBe('verb');
    });
  });
});
