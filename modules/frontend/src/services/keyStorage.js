/**
 * IndexedDB Key Storage Service — SecureCorp Frontend
 * 
 * Safely persists non-extractable CryptoKey objects in browser IndexedDB
 * scoped by userId using the browser's native Structured Clone algorithm.
 * 
 * Security Guarantees:
 * - Private keys remain non-extractable — JavaScript cannot read their raw bytes.
 * - Keys never leave the client device and never touch unencrypted localStorage.
 * - Survives browser page reloads and tab closures for the authenticated user.
 */

const DB_NAME = "securecorp_keystore";
const DB_VERSION = 1;
const STORE_NAME = "user_keys";

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

export const keyStorage = {
  isSupported() {
    return typeof indexedDB !== "undefined";
  },

  /**
   * Save user's CryptoKey objects and public key strings
   */
  async saveKeys(userId, keyData) {
    if (!userId) return false;
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const record = {
          userId,
          keyPair: keyData.keyPair,
          signingKeyPair: keyData.signingKeyPair,
          publicKeyBase64: keyData.publicKeyBase64,
          signingPublicKeyBase64: keyData.signingPublicKeyBase64,
          registeredOnBackend: Boolean(keyData.registeredOnBackend),
          updatedAt: new Date().toISOString(),
        };
        store.put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn("Failed to persist keys to IndexedDB:", err);
      return false;
    }
  },

  /**
   * Retrieve user's stored CryptoKey objects and metadata
   */
  async getKeys(userId) {
    if (!userId) return null;
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(userId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn("Failed to retrieve keys from IndexedDB:", err);
      return null;
    }
  },

  /**
   * Remove stored keys for a specific user
   */
  async deleteKeys(userId) {
    if (!userId) return false;
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(userId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn("Failed to delete keys from IndexedDB:", err);
      return false;
    }
  },
};
