/**
 * StarDict-based local/offline dictionary provider.
 * Parses the StarDict dictionary file format (.ifo/.idx/.dict[.dz]) directly —
 * the format used by the StarDict and GoldenDict desktop applications, and the
 * format most GoldenDict-distributed dictionaries ship in. No native modules or
 * external StarDict runtime is involved; this is a from-scratch parser of the
 * on-disk format.
 *
 * Format reference: https://gitlab.com/sdaaubckk/stardict/-/wikis/StarDictFileFormat
 */

import { DictionaryProvider, DictionaryResult, Definition } from '../interfaces/dictionary';

/**
 * Configuration for creating a StarDictProvider instance.
 * Provide either buffer data (ifo + idx + dict) for local initialization,
 * or URLs (ifoUrl + idxUrl + dictUrl) for async loading.
 * The .dict file may be gzip-compressed (the conventional `.dict.dz` /
 * "dictzip" form) — it is detected automatically via its gzip magic bytes
 * and decompressed transparently.
 */
export interface StarDictProviderConfig {
  /** ISO 639-1 language code this dictionary supports */
  language: string;
  /** Pre-loaded .ifo file content (plain-text metadata) */
  ifo?: ArrayBuffer | Uint8Array | string;
  /** Pre-loaded .idx file content (word index) */
  idx?: ArrayBuffer | Uint8Array;
  /** Pre-loaded .dict (or .dict.dz) file content (definitions) */
  dict?: ArrayBuffer | Uint8Array;
  /** URL to fetch the .ifo file from */
  ifoUrl?: string;
  /** URL to fetch the .idx file from */
  idxUrl?: string;
  /** URL to fetch the .dict/.dict.dz file from */
  dictUrl?: string;
}

/** Alias for StarDictProviderConfig — used as the Reader prop type */
export type StarDictDictionaryConfig = StarDictProviderConfig;

interface IndexEntry {
  offset: number;
  size: number;
}

/** Segment types whose payload is binary (size-prefixed) rather than a null-terminated string */
const BINARY_TYPES = new Set(['W', 'P']);
/** Segment types whose text content is markup and should be reduced to plain text */
const MARKUP_TYPES = new Set(['h', 'x', 'g', 'w']);

export class StarDictProvider implements DictionaryProvider {
  readonly id = 'stardict-local';
  readonly supportedLanguages: string[];
  readonly category: 'local' = 'local';
  ready: boolean;

  private index = new Map<string, IndexEntry[]>();
  private lowerCaseIndex = new Map<string, string>();
  private dictData: Uint8Array = new Uint8Array(0);
  private sameTypeSequence: string | undefined;
  private initPromise: Promise<void>;

  constructor(private config: StarDictProviderConfig) {
    this.supportedLanguages = [config.language];
    this.ready = false;

    if (config.ifo && config.idx && config.dict) {
      this.initPromise = this.initFromBuffers(config.ifo, config.idx, config.dict);
    } else if (config.ifoUrl && config.idxUrl && config.dictUrl) {
      this.initPromise = this.initFromUrls(config.ifoUrl, config.idxUrl, config.dictUrl);
    } else {
      throw new Error(
        'StarDictProvider requires either ifo/idx/dict buffers or ifoUrl/idxUrl/dictUrl strings'
      );
    }
  }

  /**
   * Wait for async initialization (parsing + decompression) to complete.
   */
  waitForReady(): Promise<void> {
    return this.initPromise;
  }

  private async initFromBuffers(
    ifo: ArrayBuffer | Uint8Array | string,
    idx: ArrayBuffer | Uint8Array,
    dict: ArrayBuffer | Uint8Array
  ): Promise<void> {
    try {
      await this.parseAll(this.toText(ifo), this.toUint8Array(idx), this.toUint8Array(dict));
      this.ready = true;
    } catch (error) {
      this.ready = false;
      throw error instanceof Error
        ? error
        : new Error(`StarDictProvider initialization failed: ${String(error)}`);
    }
  }

  private async initFromUrls(ifoUrl: string, idxUrl: string, dictUrl: string): Promise<void> {
    try {
      const [ifoResponse, idxResponse, dictResponse] = await Promise.all([
        fetch(ifoUrl),
        fetch(idxUrl),
        fetch(dictUrl),
      ]);

      if (!ifoResponse.ok) {
        throw new Error(`Failed to fetch .ifo file from ${ifoUrl}: ${ifoResponse.status} ${ifoResponse.statusText}`);
      }
      if (!idxResponse.ok) {
        throw new Error(`Failed to fetch .idx file from ${idxUrl}: ${idxResponse.status} ${idxResponse.statusText}`);
      }
      if (!dictResponse.ok) {
        throw new Error(`Failed to fetch .dict file from ${dictUrl}: ${dictResponse.status} ${dictResponse.statusText}`);
      }

      const [ifoText, idxBuffer, dictBuffer] = await Promise.all([
        ifoResponse.text(),
        idxResponse.arrayBuffer(),
        dictResponse.arrayBuffer(),
      ]);

      await this.parseAll(ifoText, new Uint8Array(idxBuffer), new Uint8Array(dictBuffer));
      this.ready = true;
    } catch (error) {
      this.ready = false;
      throw error instanceof Error
        ? error
        : new Error(`StarDictProvider failed to load dictionary files: ${String(error)}`);
    }
  }

  private async parseAll(ifoText: string, idxData: Uint8Array, dictData: Uint8Array): Promise<void> {
    const ifo = parseIfo(ifoText);
    this.sameTypeSequence = ifo.sametypesequence;
    const offsetBits = ifo.idxoffsetbits === '64' ? 64 : 32;

    this.index = parseIdx(idxData, offsetBits);
    this.lowerCaseIndex = new Map();
    for (const word of this.index.keys()) {
      const lower = word.toLowerCase();
      if (!this.lowerCaseIndex.has(lower)) {
        this.lowerCaseIndex.set(lower, word);
      }
    }

    this.dictData = await maybeDecompress(dictData);
  }

  private toText(data: ArrayBuffer | Uint8Array | string): string {
    if (typeof data === 'string') return data;
    return new TextDecoder('utf-8').decode(this.toUint8Array(data));
  }

  private toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
    return data instanceof Uint8Array ? data : new Uint8Array(data);
  }

  private findEntries(word: string): IndexEntry[] {
    const exact = this.index.get(word);
    if (exact) return exact;

    const canonical = this.lowerCaseIndex.get(word.toLowerCase());
    if (canonical) return this.index.get(canonical) ?? [];

    return [];
  }

  async lookup(
    word: string,
    language: string,
    context: string,
    signal?: AbortSignal
  ): Promise<DictionaryResult> {
    if (signal?.aborted) {
      return {
        word,
        language,
        definitions: [{ meaning: 'Lookup was cancelled.' }],
        notFound: true,
      };
    }

    if (!this.ready) {
      return {
        word,
        language,
        definitions: [{ meaning: 'Dictionary is still loading.' }],
        notFound: true,
      };
    }

    try {
      const entries = this.findEntries(word);

      if (entries.length === 0) {
        return { word, language, definitions: [], notFound: true };
      }

      const definitions: Definition[] = [];
      for (const entry of entries) {
        const data = this.dictData.subarray(entry.offset, entry.offset + entry.size);
        definitions.push(...decodeEntry(data, this.sameTypeSequence));
      }

      if (definitions.length === 0) {
        return { word, language, definitions: [], notFound: true };
      }

      return { word, language, definitions, notFound: false };
    } catch {
      return {
        word,
        language,
        definitions: [{ meaning: 'Dictionary lookup failed. Please try again.' }],
        notFound: true,
      };
    }
  }
}

/**
 * Parse a StarDict .ifo file (plain-text `key=value` lines, with a
 * `StarDict's dict ifo file` magic first line) into a lookup map.
 */
function parseIfo(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split(/\r\n|\r|\n/);
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

/**
 * Parse a StarDict .idx file: a sequence of
 * (null-terminated UTF-8 word, big-endian offset, big-endian size) records.
 * `offsetBits` is 32 (default, 4-byte offset) or 64 (8-byte offset, for very
 * large dictionaries — declared via the .ifo `idxoffsetbits` field).
 */
function parseIdx(data: Uint8Array, offsetBits: 32 | 64): Map<string, IndexEntry[]> {
  const map = new Map<string, IndexEntry[]>();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decoder = new TextDecoder('utf-8');
  let pos = 0;

  while (pos < data.length) {
    const wordStart = pos;
    let wordEnd = data.indexOf(0, wordStart);
    if (wordEnd === -1) break;
    const word = decoder.decode(data.subarray(wordStart, wordEnd));
    pos = wordEnd + 1;

    let offset: number;
    if (offsetBits === 64) {
      if (pos + 8 > data.length) break;
      offset = Number(view.getBigUint64(pos, false));
      pos += 8;
    } else {
      if (pos + 4 > data.length) break;
      offset = view.getUint32(pos, false);
      pos += 4;
    }

    if (pos + 4 > data.length) break;
    const size = view.getUint32(pos, false);
    pos += 4;

    const entry: IndexEntry = { offset, size };
    const existing = map.get(word);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(word, [entry]);
    }
  }

  return map;
}

/**
 * Detect gzip-compressed dict data (the conventional `.dict.dz` form, itself
 * a valid gzip stream) via its magic bytes and transparently decompress it
 * using the platform `DecompressionStream`. Uncompressed data passes through.
 */
async function maybeDecompress(data: Uint8Array): Promise<Uint8Array> {
  const isGzip = data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
  if (!isGzip) return data;

  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'StarDictProvider: the .dict file is gzip-compressed (.dict.dz) but this environment has no DecompressionStream support'
    );
  }

  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  const writePromise = writer.write(data as BufferSource).then(() => writer.close());

  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  await writePromise;

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Decode one dictionary entry's raw bytes into definitions, following either
 * the .ifo `sametypesequence` (every entry uses the same fixed sequence of
 * segment types, so segments carry no per-entry type marker) or, if unset,
 * StarDict's per-entry inline-type format (each segment is prefixed with its
 * own 1-byte type marker).
 */
function decodeEntry(data: Uint8Array, sameTypeSequence: string | undefined): Definition[] {
  return sameTypeSequence
    ? decodeWithSequence(data, sameTypeSequence)
    : decodeWithInlineTypes(data);
}

function decodeWithSequence(data: Uint8Array, sequence: string): Definition[] {
  const definitions: Definition[] = [];
  const decoder = new TextDecoder('utf-8');
  let pos = 0;

  for (let i = 0; i < sequence.length; i++) {
    const type = sequence[i];
    const isLast = i === sequence.length - 1;

    if (BINARY_TYPES.has(type)) {
      if (pos + 4 > data.length) break;
      const view = new DataView(data.buffer, data.byteOffset + pos, 4);
      const size = view.getUint32(0, false);
      pos += 4 + size;
      continue;
    }

    let segmentEnd: number;
    if (isLast) {
      segmentEnd = data.length;
    } else {
      const zero = data.indexOf(0, pos);
      segmentEnd = zero === -1 ? data.length : zero;
    }

    const text = decoder.decode(data.subarray(pos, segmentEnd));
    pos = isLast ? segmentEnd : segmentEnd + 1;

    const meaning = MARKUP_TYPES.has(type) ? stripMarkup(text) : text;
    if (meaning.trim()) definitions.push({ meaning });
  }

  return definitions;
}

function decodeWithInlineTypes(data: Uint8Array): Definition[] {
  const definitions: Definition[] = [];
  const decoder = new TextDecoder('utf-8');
  let pos = 0;

  while (pos < data.length) {
    const type = String.fromCharCode(data[pos]);
    pos += 1;

    if (BINARY_TYPES.has(type)) {
      if (pos + 4 > data.length) break;
      const view = new DataView(data.buffer, data.byteOffset + pos, 4);
      const size = view.getUint32(0, false);
      pos += 4 + size;
      continue;
    }

    const zero = data.indexOf(0, pos);
    const segmentEnd = zero === -1 ? data.length : zero;
    const text = decoder.decode(data.subarray(pos, segmentEnd));
    pos = zero === -1 ? segmentEnd : segmentEnd + 1;

    const meaning = MARKUP_TYPES.has(type) ? stripMarkup(text) : text;
    if (meaning.trim()) definitions.push({ meaning });
  }

  return definitions;
}

/** Reduce HTML/XDXF/Pango-markup text to plain text for display. */
function stripMarkup(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
