import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { cryptoAdapter } from "../services/cryptoAdapter";
import { portalApi } from "../services/portalApi";
import { keyStorage } from "../services/keyStorage";
import { useAuth } from "./AuthContext";

const KeyContext = createContext(null);

export const KeyProvider = ({ children }) => {
  const { userId, ticket } = useAuth();

  const [keysState, setKeysState] = useState({
    keyPair: null,               // { publicKey, privateKey } RSA-OAEP
    signingKeyPair: null,        // { publicKey, privateKey } RSA-PSS
    publicKeyBase64: null,       // Exported base64 SPKI — encryption key
    signingPublicKeyBase64: null,// Exported base64 SPKI — signing key
    serverPublicKeyBase64: null, // Public key confirmed registered on server
    registeredOnBackend: false,
    hasKeys: false,
  });

  const [keyStatus, setKeyStatus] = useState("SYNCING"); // SYNCING, NOT_CONFIGURED, READY, SERVER_ONLY
  const [keyError, setKeyError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Synchronize keys from IndexedDB & Portal API on mount or user switch
  const syncKeys = useCallback(async () => {
    if (!userId) {
      setKeysState({
        keyPair: null,
        signingKeyPair: null,
        publicKeyBase64: null,
        signingPublicKeyBase64: null,
        serverPublicKeyBase64: null,
        registeredOnBackend: false,
        hasKeys: false,
      });
      setKeyStatus("NOT_CONFIGURED");
      setLoading(false);
      return;
    }

    setLoading(true);
    setKeyError(null);

    try {
      // 1. Retrieve user's keypair from browser IndexedDB
      const localKeys = await keyStorage.getKeys(userId);

      // 2. Fetch user's registered public key from Portal API
      let serverPubKey = null;
      try {
        const serverRes = await portalApi.getPublicKey(userId, ticket);
        if (serverRes?.body?.public_key) {
          serverPubKey = serverRes.body.public_key;
        }
      } catch (err) {
        // 404 is normal if user has not registered keys yet
      }

      if (localKeys && localKeys.keyPair) {
        // Check if locally exported public key matches server registration
        const isRegistered = Boolean(serverPubKey && localKeys.publicKeyBase64 === serverPubKey);

        setKeysState({
          keyPair: localKeys.keyPair,
          signingKeyPair: localKeys.signingKeyPair,
          publicKeyBase64: localKeys.publicKeyBase64,
          signingPublicKeyBase64: localKeys.signingPublicKeyBase64,
          serverPublicKeyBase64: serverPubKey,
          registeredOnBackend: isRegistered || Boolean(localKeys.registeredOnBackend),
          hasKeys: true,
        });
        setKeyStatus("READY");
      } else if (serverPubKey) {
        // Server has a registered public key, but this browser does not have the private key
        setKeysState({
          keyPair: null,
          signingKeyPair: null,
          publicKeyBase64: null,
          signingPublicKeyBase64: null,
          serverPublicKeyBase64: serverPubKey,
          registeredOnBackend: true,
          hasKeys: false,
        });
        setKeyStatus("SERVER_ONLY");
      } else {
        // No keys locally and none on server
        setKeysState({
          keyPair: null,
          signingKeyPair: null,
          publicKeyBase64: null,
          signingPublicKeyBase64: null,
          serverPublicKeyBase64: null,
          registeredOnBackend: false,
          hasKeys: false,
        });
        setKeyStatus("NOT_CONFIGURED");
      }
    } catch (err) {
      console.error("Key synchronization error:", err);
      setKeyError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, ticket]);

  useEffect(() => {
    syncKeys();
  }, [syncKeys]);

  const generateKeys = async () => {
    setKeyError(null);
    try {
      if (!cryptoAdapter.isAvailable()) {
        setKeyStatus("PENDING_CRYPTO");
        throw new Error(
          "Crypto Core module is not connected. Keypair generation relies on modules/crypto-core."
        );
      }

      const keyPair = await cryptoAdapter.generateKeyPair();
      const signingKeyPair = await cryptoAdapter.generateSigningKeyPair();
      const publicKeyBase64 = await cryptoAdapter.exportPublicKeyAsBase64(keyPair.publicKey);
      const signingPublicKeyBase64 = await cryptoAdapter.exportPublicKeyAsBase64(signingKeyPair.publicKey);

      const nextKeys = {
        keyPair,
        signingKeyPair,
        publicKeyBase64,
        signingPublicKeyBase64,
        serverPublicKeyBase64: keysState.serverPublicKeyBase64,
        registeredOnBackend: false,
        hasKeys: true,
      };

      setKeysState(nextKeys);
      setKeyStatus("READY");

      // Persist to IndexedDB scoped by userId
      if (userId) {
        await keyStorage.saveKeys(userId, nextKeys);
      }

      return { success: true, keys: nextKeys };
    } catch (err) {
      setKeyError(err.message);
      return { success: false, error: err.message };
    }
  };

  const registerKeyOnBackend = async (uid = userId, tkt = ticket) => {
    setKeyError(null);
    try {
      if (!keysState.publicKeyBase64) {
        throw new Error("No public key available to register. Generate keys first.");
      }

      await portalApi.registerKey(uid, keysState.publicKeyBase64, "RSA-OAEP-2048", tkt);

      const updated = {
        ...keysState,
        registeredOnBackend: true,
        serverPublicKeyBase64: keysState.publicKeyBase64,
      };

      setKeysState(updated);

      // Persist registered flag to IndexedDB
      if (uid) {
        await keyStorage.saveKeys(uid, updated);
      }

      return { success: true };
    } catch (err) {
      const msg = err.message || "Failed to register public key on server";
      setKeyError(msg);
      return { success: false, error: msg };
    }
  };

  const clearKeys = async () => {
    if (userId) {
      await keyStorage.deleteKeys(userId);
    }
    setKeysState({
      keyPair: null,
      signingKeyPair: null,
      publicKeyBase64: null,
      signingPublicKeyBase64: null,
      serverPublicKeyBase64: null,
      registeredOnBackend: false,
      hasKeys: false,
    });
    setKeyStatus("NOT_CONFIGURED");
  };

  return (
    <KeyContext.Provider
      value={{
        ...keysState,
        keyStatus,
        keyError,
        loading,
        generateKeys,
        registerKeyOnBackend,
        syncKeys,
        clearKeys,
        cryptoAvailable: cryptoAdapter.isAvailable(),
      }}
    >
      {children}
    </KeyContext.Provider>
  );
};

export const useKeys = () => {
  const context = useContext(KeyContext);
  if (!context) {
    throw new Error("useKeys must be used within a KeyProvider");
  }
  return context;
};
