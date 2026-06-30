/**
 * IndexedDB-based bookmark store for the Universal Ebook Reader.
 * Provides high-capacity bookmark persistence using the browser's IndexedDB API.
 */

import { Bookmark } from '../models/bookmark';
import { BookmarkStoreInterface } from '../interfaces/bookmark-store';

const DEFAULT_DB_NAME = 'qari-bookmarks-db';
const STORE_NAME = 'bookmarks';
const BOOK_ID_INDEX = 'bookId';

export class IndexedDBStore implements BookmarkStoreInterface {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly storeName: string = STORE_NAME;

  constructor(dbName?: string) {
    this.dbName = dbName ?? DEFAULT_DB_NAME;
  }

  private openDB(): Promise<IDBDatabase> {
    if (this.db) {
      return Promise.resolve(this.db);
    }

    return new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;

      try {
        request = indexedDB.open(this.dbName, 1);
      } catch (error) {
        reject(new Error(`Failed to open IndexedDB: ${(error as Error).message}`));
        return;
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex(BOOK_ID_INDEX, 'bookId', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        reject(new Error(`Failed to open IndexedDB: ${error?.message ?? 'unknown error'}`));
      };
    });
  }

  async save(bookmark: Bookmark): Promise<void> {
    let db: IDBDatabase;
    try {
      db = await this.openDB();
    } catch (error) {
      throw new Error(`save: ${(error as Error).message}`);
    }

    return new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(bookmark);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          reject(new Error(`save: transaction failed - ${error?.message ?? 'unknown error'}`));
        };

        transaction.onerror = (event) => {
          const error = (event.target as IDBTransaction).error;
          reject(new Error(`save: transaction failed - ${error?.message ?? 'unknown error'}`));
        };
      } catch (error) {
        reject(new Error(`save: ${(error as Error).message}`));
      }
    });
  }

  async load(bookId: string): Promise<Bookmark[]> {
    let db: IDBDatabase;
    try {
      db = await this.openDB();
    } catch (error) {
      throw new Error(`load: ${(error as Error).message}`);
    }

    return new Promise<Bookmark[]>((resolve, reject) => {
      try {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const index = store.index(BOOK_ID_INDEX);
        const request = index.getAll(bookId);

        request.onsuccess = (event) => {
          resolve((event.target as IDBRequest<Bookmark[]>).result);
        };

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          reject(new Error(`load: transaction failed - ${error?.message ?? 'unknown error'}`));
        };

        transaction.onerror = (event) => {
          const error = (event.target as IDBTransaction).error;
          reject(new Error(`load: transaction failed - ${error?.message ?? 'unknown error'}`));
        };
      } catch (error) {
        reject(new Error(`load: ${(error as Error).message}`));
      }
    });
  }

  async list(): Promise<Bookmark[]> {
    let db: IDBDatabase;
    try {
      db = await this.openDB();
    } catch (error) {
      throw new Error(`list: ${(error as Error).message}`);
    }

    return new Promise<Bookmark[]>((resolve, reject) => {
      try {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = (event) => {
          resolve((event.target as IDBRequest<Bookmark[]>).result);
        };

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          reject(new Error(`list: transaction failed - ${error?.message ?? 'unknown error'}`));
        };

        transaction.onerror = (event) => {
          const error = (event.target as IDBTransaction).error;
          reject(new Error(`list: transaction failed - ${error?.message ?? 'unknown error'}`));
        };
      } catch (error) {
        reject(new Error(`list: ${(error as Error).message}`));
      }
    });
  }

  async remove(bookmarkId: string): Promise<void> {
    let db: IDBDatabase;
    try {
      db = await this.openDB();
    } catch (error) {
      throw new Error(`remove: ${(error as Error).message}`);
    }

    return new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(bookmarkId);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          reject(new Error(`remove: transaction failed - ${error?.message ?? 'unknown error'}`));
        };

        transaction.onerror = (event) => {
          const error = (event.target as IDBTransaction).error;
          reject(new Error(`remove: transaction failed - ${error?.message ?? 'unknown error'}`));
        };
      } catch (error) {
        reject(new Error(`remove: ${(error as Error).message}`));
      }
    });
  }

  async update(bookmark: Bookmark): Promise<void> {
    let db: IDBDatabase;
    try {
      db = await this.openDB();
    } catch (error) {
      throw new Error(`update: ${(error as Error).message}`);
    }

    return new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);

        // Verify existence first
        const getRequest = store.get(bookmark.id);

        getRequest.onsuccess = (event) => {
          const existing = (event.target as IDBRequest<Bookmark | undefined>).result;
          if (!existing) {
            reject(new Error(`update: bookmark not found`));
            return;
          }

          const putRequest = store.put(bookmark);

          putRequest.onsuccess = () => {
            resolve();
          };

          putRequest.onerror = (event) => {
            const error = (event.target as IDBRequest).error;
            reject(new Error(`update: transaction failed - ${error?.message ?? 'unknown error'}`));
          };
        };

        getRequest.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          reject(new Error(`update: transaction failed - ${error?.message ?? 'unknown error'}`));
        };

        transaction.onerror = (event) => {
          const error = (event.target as IDBTransaction).error;
          reject(new Error(`update: transaction failed - ${error?.message ?? 'unknown error'}`));
        };
      } catch (error) {
        reject(new Error(`update: ${(error as Error).message}`));
      }
    });
  }
}
