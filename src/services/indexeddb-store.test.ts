/**
 * Unit tests for IndexedDBStore.
 * Tests database initialization, schema creation, connection failure error format,
 * and transaction error handling.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBStore } from './indexeddb-store';
import { Bookmark } from '../models/bookmark';

function createBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: `bm-${Math.random().toString(36).slice(2)}`,
    bookId: 'book-1',
    chapterId: 'ch-1',
    position: 0,
    name: 'Test Bookmark',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('IndexedDBStore', () => {
  let store: IndexedDBStore;

  beforeEach(() => {
    store = new IndexedDBStore(`test-db-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('database initialization and schema creation', () => {
    it('should create the object store and bookId index on first open', async () => {
      // Trigger a database open by performing a save
      const bookmark = createBookmark();
      await store.save(bookmark);

      // Verify by loading - if the index works, load by bookId succeeds
      const results = await store.load(bookmark.bookId);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(bookmark.id);
    });

    it('should use "id" as the keyPath for the object store', async () => {
      const bookmark = createBookmark();
      await store.save(bookmark);

      // Save another bookmark with same id - should overwrite (put semantics)
      const updated = { ...bookmark, name: 'Updated Name' };
      await store.save(updated);

      const results = await store.list();
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Updated Name');
    });

    it('should create a non-unique bookId index for filtered queries', async () => {
      // Save multiple bookmarks with same bookId
      const bm1 = createBookmark({ bookId: 'book-A' });
      const bm2 = createBookmark({ bookId: 'book-A' });
      const bm3 = createBookmark({ bookId: 'book-B' });

      await store.save(bm1);
      await store.save(bm2);
      await store.save(bm3);

      // Index should allow filtering by bookId
      const bookAResults = await store.load('book-A');
      expect(bookAResults).toHaveLength(2);

      const bookBResults = await store.load('book-B');
      expect(bookBResults).toHaveLength(1);
    });

    it('should use default database name when none provided', async () => {
      const defaultStore = new IndexedDBStore();
      const bookmark = createBookmark();
      await defaultStore.save(bookmark);

      const results = await defaultStore.load(bookmark.bookId);
      expect(results).toHaveLength(1);
    });
  });

  describe('connection failure error format', () => {
    it('should include operation name "save" in error on connection failure', async () => {
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const request = {} as IDBOpenDBRequest;
        const listeners: Record<string, EventListener> = {};
        Object.defineProperty(request, 'onerror', {
          set: (fn: EventListener) => {
            listeners['error'] = fn;
            setTimeout(() => {
              Object.defineProperty(request, 'error', {
                value: new DOMException('Access denied'),
                configurable: true,
              });
              fn({ target: request } as unknown as Event);
            }, 0);
          },
          get: () => listeners['error'],
        });
        Object.defineProperty(request, 'onsuccess', {
          set: () => {},
          get: () => null,
        });
        Object.defineProperty(request, 'onupgradeneeded', {
          set: () => {},
          get: () => null,
        });
        return request;
      });

      const failStore = new IndexedDBStore('fail-db');
      await expect(failStore.save(createBookmark())).rejects.toThrow(/^save:/);
    });

    it('should include operation name "load" in error on connection failure', async () => {
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const request = {} as IDBOpenDBRequest;
        const listeners: Record<string, EventListener> = {};
        Object.defineProperty(request, 'addEventListener', {
          value: (_type: string, _listener: EventListener) => {},
        });
        Object.defineProperty(request, 'onerror', {
          set: (fn: EventListener) => {
            listeners['error'] = fn;
            setTimeout(() => {
              Object.defineProperty(request, 'error', {
                value: new DOMException('Connection refused'),
                configurable: true,
              });
              fn({ target: request } as unknown as Event);
            }, 0);
          },
          get: () => listeners['error'],
        });
        Object.defineProperty(request, 'onsuccess', {
          set: () => {},
          get: () => null,
        });
        Object.defineProperty(request, 'onupgradeneeded', {
          set: () => {},
          get: () => null,
        });
        return request;
      });

      const failStore = new IndexedDBStore('fail-db-load');
      await expect(failStore.load('book-1')).rejects.toThrow(/^load:/);
    });

    it('should include operation name "list" in error on connection failure', async () => {
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const request = {} as IDBOpenDBRequest;
        const listeners: Record<string, EventListener> = {};
        Object.defineProperty(request, 'onerror', {
          set: (fn: EventListener) => {
            listeners['error'] = fn;
            setTimeout(() => {
              Object.defineProperty(request, 'error', {
                value: new DOMException('Connection refused'),
                configurable: true,
              });
              fn({ target: request } as unknown as Event);
            }, 0);
          },
          get: () => listeners['error'],
        });
        Object.defineProperty(request, 'onsuccess', {
          set: () => {},
          get: () => null,
        });
        Object.defineProperty(request, 'onupgradeneeded', {
          set: () => {},
          get: () => null,
        });
        return request;
      });

      const failStore = new IndexedDBStore('fail-db-list');
      await expect(failStore.list()).rejects.toThrow(/^list:/);
    });

    it('should include operation name "remove" in error on connection failure', async () => {
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const request = {} as IDBOpenDBRequest;
        const listeners: Record<string, EventListener> = {};
        Object.defineProperty(request, 'onerror', {
          set: (fn: EventListener) => {
            listeners['error'] = fn;
            setTimeout(() => {
              Object.defineProperty(request, 'error', {
                value: new DOMException('Connection refused'),
                configurable: true,
              });
              fn({ target: request } as unknown as Event);
            }, 0);
          },
          get: () => listeners['error'],
        });
        Object.defineProperty(request, 'onsuccess', {
          set: () => {},
          get: () => null,
        });
        Object.defineProperty(request, 'onupgradeneeded', {
          set: () => {},
          get: () => null,
        });
        return request;
      });

      const failStore = new IndexedDBStore('fail-db-remove');
      await expect(failStore.remove('some-id')).rejects.toThrow(/^remove:/);
    });

    it('should include operation name "update" in error on connection failure', async () => {
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const request = {} as IDBOpenDBRequest;
        const listeners: Record<string, EventListener> = {};
        Object.defineProperty(request, 'onerror', {
          set: (fn: EventListener) => {
            listeners['error'] = fn;
            setTimeout(() => {
              Object.defineProperty(request, 'error', {
                value: new DOMException('Connection refused'),
                configurable: true,
              });
              fn({ target: request } as unknown as Event);
            }, 0);
          },
          get: () => listeners['error'],
        });
        Object.defineProperty(request, 'onsuccess', {
          set: () => {},
          get: () => null,
        });
        Object.defineProperty(request, 'onupgradeneeded', {
          set: () => {},
          get: () => null,
        });
        return request;
      });

      const failStore = new IndexedDBStore('fail-db-update');
      await expect(failStore.update(createBookmark())).rejects.toThrow(/^update:/);
    });

    it('should include "Failed to open IndexedDB" in the error message', async () => {
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const request = {} as IDBOpenDBRequest;
        const listeners: Record<string, EventListener> = {};
        Object.defineProperty(request, 'onerror', {
          set: (fn: EventListener) => {
            listeners['error'] = fn;
            setTimeout(() => {
              Object.defineProperty(request, 'error', {
                value: new DOMException('Disk full'),
                configurable: true,
              });
              fn({ target: request } as unknown as Event);
            }, 0);
          },
          get: () => listeners['error'],
        });
        Object.defineProperty(request, 'onsuccess', {
          set: () => {},
          get: () => null,
        });
        Object.defineProperty(request, 'onupgradeneeded', {
          set: () => {},
          get: () => null,
        });
        return request;
      });

      const failStore = new IndexedDBStore('fail-db-msg');
      await expect(failStore.save(createBookmark())).rejects.toThrow(
        /save: Failed to open IndexedDB/
      );
    });
  });

  describe('transaction error handling', () => {
    it('should include operation name in transaction error for save', async () => {
      // First, successfully open the database
      const bookmark = createBookmark();
      await store.save(bookmark);

      // Now mock the transaction to fail on the next save
      const db = (store as unknown as { db: IDBDatabase }).db;
      const originalTransaction = db.transaction.bind(db);
      vi.spyOn(db, 'transaction').mockImplementation((...args) => {
        const tx = originalTransaction(...args);
        // Override the objectStore to return a store whose put request errors
        const originalObjectStore = tx.objectStore.bind(tx);
        vi.spyOn(tx, 'objectStore').mockImplementation((name) => {
          const objStore = originalObjectStore(name);
          vi.spyOn(objStore, 'put').mockImplementation(() => {
            const request = {} as IDBRequest;
            setTimeout(() => {
              Object.defineProperty(request, 'error', {
                value: new DOMException('Write failed'),
                configurable: true,
              });
              if ((request as unknown as { onerror: Function }).onerror) {
                (request as unknown as { onerror: Function }).onerror({
                  target: request,
                } as unknown as Event);
              }
            }, 0);
            Object.defineProperty(request, 'onsuccess', { set: () => {}, get: () => null });
            Object.defineProperty(request, 'onerror', {
              set: (fn: Function) => {
                (request as unknown as { _onerror: Function })._onerror = fn;
                Object.defineProperty(request, 'onerror', {
                  get: () => fn,
                  set: () => {},
                  configurable: true,
                });
              },
              get: () => (request as unknown as { _onerror: Function })._onerror,
              configurable: true,
            });
            return request;
          });
          return objStore;
        });
        return tx;
      });

      const newBookmark = createBookmark();
      await expect(store.save(newBookmark)).rejects.toThrow(/^save:/);
    });

    it('should include "transaction failed" in transaction error messages', async () => {
      // Open the database first
      const bookmark = createBookmark();
      await store.save(bookmark);

      // Mock transaction to produce an error via request.onerror
      const db = (store as unknown as { db: IDBDatabase }).db;
      const originalTransaction = db.transaction.bind(db);
      vi.spyOn(db, 'transaction').mockImplementation((...args) => {
        const tx = originalTransaction(...args);
        const originalObjectStore = tx.objectStore.bind(tx);
        vi.spyOn(tx, 'objectStore').mockImplementation((name) => {
          const objStore = originalObjectStore(name);
          const originalPut = objStore.put.bind(objStore);
          vi.spyOn(objStore, 'put').mockImplementation((_value) => {
            // Create a real request but intercept its result to simulate error
            const fakeReq = originalPut({ id: '__noop__', bookId: 'x', chapterId: 'x', position: 0, name: 'x', createdAt: 'x' });
            // Override onsuccess to not fire, and fire onerror instead
            const origOnSuccessSetter = Object.getOwnPropertyDescriptor(fakeReq, 'onsuccess') 
              || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(fakeReq), 'onsuccess');
            
            let errorHandler: Function | null = null;
            Object.defineProperty(fakeReq, 'onsuccess', {
              set: () => { /* swallow */ },
              get: () => null,
              configurable: true,
            });
            Object.defineProperty(fakeReq, 'onerror', {
              set: (fn: Function) => {
                errorHandler = fn;
                setTimeout(() => {
                  Object.defineProperty(fakeReq, 'error', {
                    value: new DOMException('Quota exceeded'),
                    configurable: true,
                  });
                  if (errorHandler) {
                    errorHandler({ target: fakeReq } as unknown as Event);
                  }
                }, 0);
              },
              get: () => errorHandler,
              configurable: true,
            });
            return fakeReq;
          });
          return objStore;
        });
        return tx;
      });

      const newBookmark = createBookmark();
      await expect(store.save(newBookmark)).rejects.toThrow(/transaction failed/);
    });

    it('should reject with operation name when indexedDB.open throws synchronously', async () => {
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        throw new Error('SecurityError: access denied');
      });

      const failStore = new IndexedDBStore('throw-db');
      await expect(failStore.save(createBookmark())).rejects.toThrow(/^save:/);
    });
  });
});
