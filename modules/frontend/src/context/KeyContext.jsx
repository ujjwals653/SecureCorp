import React, { createContext, useContext, useState } from "react";
import { cryptoAdapter } from "../services/cryptoAdapter";

const KeyContext = createContext(null);

export const KeyProvider = ({ children }) => {
  // In-memory key state ONLY (CryptoKey objects or Base64 string references)
  // Private keys NEVER touch localStorage or IndexedDB.
  const [keysState, setKeysState] = useState({
    keyPair: null,          // { publicKey, privateKey } RSA-OAEP
    signingKeyPair: null,   // { publicKey, privateKey } RSA-PSS/ECDSA
    publicKeyBase64: null,  // Exported base64 SPKI
    registeredOnBackend: false,
    hasKeys: false,
  });

  const [keyStatus, setKeyStatus] = useState("NOT_CONFIGURED"); // NOT_CONFIGURED, PENDING_CRYPTO, READY
  const [keyError, setKeyError] = useState(null);

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

      setKeysState({
        keyPair,
        signingKeyPair,
        publicKeyBase64,
        registeredOnBackend: false,
        hasKeys: true,
      });

      setKeyStatus("READY");
      return { success: true };
    } catch (err) {
      setKeyError(err.message);
      return { success: false, error: err.message };
    }
  };

  const clearKeys = () => {
    setKeysState({
      keyPair: null,
      signingKeyPair: null,
      publicKeyBase64: null,
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
        generateKeys,
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
