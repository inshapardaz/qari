/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import zlib from 'node:zlib';
import { StarDictProvider, StarDictProviderConfig } from './stardict-provider';

const encoder = new TextEncoder();

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function u32be(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n, false);
  return buf;
}

/**
 * Build a minimal in-memory StarDict dictionary (ifo/idx/dict) from a list of
 * word -> single-segment-per-type payloads, all following one `sametypesequence`.
 */
function buildStarDict(
  entries: { word: string; segments: string[] }[],
  options: { sameTypeSequence?: string; idxoffsetbits?: '32' | '64' } = {}
): { ifo: string; idx: Uint8Array; dict: Uint8Array } {
  const sameTypeSequence = options.sameTypeSequence ?? 'm';
  const idxChunks: Uint8Array[] = [];
  const dictChunks: Uint8Array[] = [];
  let dictOffset = 0;

  for (const { word, segments } of entries) {
    const entryChunks: Uint8Array[] = [];
    segments.forEach((segment, i) => {
      const bytes = encoder.encode(segment);
      entryChunks.push(bytes);
      const isLast = i === segments.length - 1;
      if (!isLast) entryChunks.push(new Uint8Array([0]));
    });
    const entryBytes = concatBytes(entryChunks);
    dictChunks.push(entryBytes);

    const wordBytes = encoder.encode(word);
    const offsetBytes = u32be(dictOffset);
    const sizeBytes = u32be(entryBytes.length);
    idxChunks.push(concatBytes([wordBytes, new Uint8Array([0]), offsetBytes, sizeBytes]));

    dictOffset += entryBytes.length;
  }

  const ifo = [
    `StarDict's dict ifo file`,
    'version=2.4.2',
    'bookname=Test Dictionary',
    `wordcount=${entries.length}`,
    `sametypesequence=${sameTypeSequence}`,
    ...(options.idxoffsetbits ? [`idxoffsetbits=${options.idxoffsetbits}`] : []),
  ].join('\n');

  return { ifo, idx: concatBytes(idxChunks), dict: concatBytes(dictChunks) };
}

describe('StarDictProvider', () => {
  describe('Initialization with buffers', () => {
    it('parses and becomes ready for plain-text (sametypesequence=m) entries', async () => {
      const { ifo, idx, dict } = buildStarDict([
        { word: 'hello', segments: ['a greeting'] },
        { word: 'world', segments: ['the earth'] },
      ]);

      const provider = new StarDictProvider({ language: 'en', ifo, idx, dict });
      await provider.waitForReady();

      expect(provider.ready).toBe(true);
      expect(provider.id).toBe('stardict-local');
      expect(provider.category).toBe('local');
      expect(provider.supportedLanguages).toEqual(['en']);
    });

    it('accepts ArrayBuffer/Uint8Array forms for ifo/idx/dict', async () => {
      const { ifo, idx, dict } = buildStarDict([{ word: 'hi', segments: ['greeting'] }]);

      const provider = new StarDictProvider({
        language: 'en',
        ifo: encoder.encode(ifo).buffer as ArrayBuffer,
        idx: idx.buffer as ArrayBuffer,
        dict,
      });
      await provider.waitForReady();

      expect(provider.ready).toBe(true);
      const result = await provider.lookup('hi', 'en', 'hi there');
      expect(result.definitions).toEqual([{ meaning: 'greeting' }]);
    });

    it('throws when neither buffers nor URLs are provided', () => {
      expect(() => {
        new StarDictProvider({ language: 'en' } as StarDictProviderConfig);
      }).toThrow('StarDictProvider requires either ifo/idx/dict buffers or ifoUrl/idxUrl/dictUrl strings');
    });
  });

  describe('Lookup', () => {
    it('returns the definition for an exact word match', async () => {
      const { ifo, idx, dict } = buildStarDict([
        { word: 'apple', segments: ['a round fruit'] },
      ]);
      const provider = new StarDictProvider({ language: 'en', ifo, idx, dict });
      await provider.waitForReady();

      const result = await provider.lookup('apple', 'en', 'an apple a day');

      expect(result.word).toBe('apple');
      expect(result.notFound).toBe(false);
      expect(result.definitions).toEqual([{ meaning: 'a round fruit' }]);
    });

    it('falls back to case-insensitive match', async () => {
      const { ifo, idx, dict } = buildStarDict([
        { word: 'Apple', segments: ['a round fruit'] },
      ]);
      const provider = new StarDictProvider({ language: 'en', ifo, idx, dict });
      await provider.waitForReady();

      const result = await provider.lookup('apple', 'en', 'an apple a day');

      expect(result.notFound).toBe(false);
      expect(result.definitions).toEqual([{ meaning: 'a round fruit' }]);
    });

    it('returns notFound for a word absent from the index', async () => {
      const { ifo, idx, dict } = buildStarDict([{ word: 'apple', segments: ['fruit'] }]);
      const provider = new StarDictProvider({ language: 'en', ifo, idx, dict });
      await provider.waitForReady();

      const result = await provider.lookup('banana', 'en', 'a banana');

      expect(result.notFound).toBe(true);
      expect(result.definitions).toEqual([]);
    });

    it('merges definitions from multiple homograph entries for the same word', async () => {
      const { ifo, idx, dict } = buildStarDict([
        { word: 'bank', segments: ['a financial institution'] },
        { word: 'bank', segments: ['the side of a river'] },
      ]);
      const provider = new StarDictProvider({ language: 'en', ifo, idx, dict });
      await provider.waitForReady();

      const result = await provider.lookup('bank', 'en', 'river bank');

      expect(result.definitions).toEqual([
        { meaning: 'a financial institution' },
        { meaning: 'the side of a river' },
      ]);
    });

    it('strips HTML markup for sametypesequence=h entries', async () => {
      const { ifo, idx, dict } = buildStarDict(
        [{ word: 'cat', segments: ['<b>cat</b><br/>a small feline'] }],
        { sameTypeSequence: 'h' }
      );
      const provider = new StarDictProvider({ language: 'en', ifo, idx, dict });
      await provider.waitForReady();

      const result = await provider.lookup('cat', 'en', 'the cat sat');

      expect(result.definitions).toEqual([{ meaning: 'cat a small feline' }]);
    });

    it('decodes multi-segment entries under a multi-char sametypesequence', async () => {
      const { ifo, idx, dict } = buildStarDict(
        [{ word: 'dog', segments: ['a domestic animal', '<i>canine</i>'] }],
        { sameTypeSequence: 'mh' }
      );
      const provider = new StarDictProvider({ language: 'en', ifo, idx, dict });
      await provider.waitForReady();

      const result = await provider.lookup('dog', 'en', 'the dog barked');

      expect(result.definitions).toEqual([
        { meaning: 'a domestic animal' },
        { meaning: 'canine' },
      ]);
    });

    it('decodes entries with no sametypesequence via inline per-segment type markers', async () => {
      const meaning = 'a rodent';
      const meaningBytes = encoder.encode(meaning);
      // Inline format: 1-byte type char, then null-terminated text.
      const entryBytes = concatBytes([
        new Uint8Array([0x6d]), // 'm'
        meaningBytes,
        new Uint8Array([0]),
      ]);
      const wordBytes = encoder.encode('mouse');
      const idx = concatBytes([wordBytes, new Uint8Array([0]), u32be(0), u32be(entryBytes.length)]);
      const ifo = [
        `StarDict's dict ifo file`,
        'version=2.4.2',
        'bookname=Test Dictionary',
        'wordcount=1',
      ].join('\n');

      const provider = new StarDictProvider({ language: 'en', ifo, idx, dict: entryBytes });
      await provider.waitForReady();

      const result = await provider.lookup('mouse', 'en', 'a mouse ran');

      expect(result.definitions).toEqual([{ meaning: 'a rodent' }]);
    });

    it('returns the still-loading message before initialization completes', async () => {
      const mockFetch = vi.fn().mockImplementation(() => new Promise(() => {}));
      vi.stubGlobal('fetch', mockFetch);

      const provider = new StarDictProvider({
        language: 'en',
        ifoUrl: 'https://example.com/en.ifo',
        idxUrl: 'https://example.com/en.idx',
        dictUrl: 'https://example.com/en.dict',
      });

      expect(provider.ready).toBe(false);
      const result = await provider.lookup('anything', 'en', 'anything at all');
      expect(result.notFound).toBe(true);
      expect(result.definitions[0].meaning).toContain('still loading');

      vi.unstubAllGlobals();
    });

    it('returns a cancelled result when the signal is already aborted', async () => {
      const { ifo, idx, dict } = buildStarDict([{ word: 'apple', segments: ['fruit'] }]);
      const provider = new StarDictProvider({ language: 'en', ifo, idx, dict });
      await provider.waitForReady();

      const controller = new AbortController();
      controller.abort();

      const result = await provider.lookup('apple', 'en', 'an apple', controller.signal);

      expect(result.notFound).toBe(true);
      expect(result.definitions[0].meaning).toContain('cancelled');
    });
  });

  describe('Gzip-compressed .dict.dz support', () => {
    it('transparently decompresses a gzip-compressed dict file', async () => {
      const { ifo, idx, dict } = buildStarDict([
        { word: 'sun', segments: ['the star at the centre of the solar system'] },
      ]);
      const compressedDict = new Uint8Array(zlib.gzipSync(Buffer.from(dict)));

      const provider = new StarDictProvider({ language: 'en', ifo, idx, dict: compressedDict });
      await provider.waitForReady();

      expect(provider.ready).toBe(true);
      const result = await provider.lookup('sun', 'en', 'the sun rises');
      expect(result.definitions).toEqual([{ meaning: 'the star at the centre of the solar system' }]);
    });
  });

  describe('Initialization with URLs', () => {
    it('fetches ifo/idx/dict from URLs and becomes ready', async () => {
      const { ifo, idx, dict } = buildStarDict([{ word: 'star', segments: ['a luminous point'] }]);

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('.ifo')) return Promise.resolve({ ok: true, text: () => Promise.resolve(ifo) });
        if (url.endsWith('.idx')) return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(idx.buffer) });
        if (url.endsWith('.dict')) return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(dict.buffer) });
        return Promise.reject(new Error('unexpected url'));
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new StarDictProvider({
        language: 'en',
        ifoUrl: 'https://example.com/en.ifo',
        idxUrl: 'https://example.com/en.idx',
        dictUrl: 'https://example.com/en.dict',
      });

      expect(provider.ready).toBe(false);
      await provider.waitForReady();
      expect(provider.ready).toBe(true);

      const result = await provider.lookup('star', 'en', 'a bright star');
      expect(result.definitions).toEqual([{ meaning: 'a luminous point' }]);

      vi.unstubAllGlobals();
    });

    it('rejects and stays not-ready when a URL fetch fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new StarDictProvider({
        language: 'en',
        ifoUrl: 'https://example.com/en.ifo',
        idxUrl: 'https://example.com/en.idx',
        dictUrl: 'https://example.com/en.dict',
      });

      await expect(provider.waitForReady()).rejects.toThrow('Failed to fetch');
      expect(provider.ready).toBe(false);

      vi.unstubAllGlobals();
    });
  });
});
