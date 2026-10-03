import React, { createContext, useContext, useState, useEffect } from "react";
import { portalApi } from "../services/portalApi";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(() => {
    // Session state restored from sessionStorage if active (non-sensitive token session)
    const saved = sessionStorage.getItem("securecorp_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (new Date(parsed.expiresAt) > new Date()) {
          return parsed;
        }
      } catch (e) {
        sessionStorage.removeItem("securecorp_session");
      }
    }
    return {
      userId: null,
      role: null,
      ticket: null,
      issuedAt: null,
      expiresAt: null,
      isAuthenticated: false,
    };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (userId, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await portalApi.login(userId, password);
      const data = response.body;

      const newAuthState = {
        userId: data.user_id,
        role: data.role,
        ticket: data.ticket,
        issuedAt: data.issued_at,
        expiresAt: data.expires_at,
        isAuthenticated: true,
      };

      setAuthState(newAuthState);
      sessionStorage.setItem("securecorp_session", JSON.stringify(newAuthState));
      setLoading(false);
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || "Authentication failed. Please verify credentials.";
      setError(errorMsg);
      setLoading(false);
      return { success: false, error: errorMsg };
    }
  };

  const logout = () => {
    setAuthState({
      userId: null,
      role: null,
      ticket: null,
      issuedAt: null,
      expiresAt: null,
      isAuthenticated: false,
    });
    sessionStorage.removeItem("securecorp_session");
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        loading,
        error,
        login,
        logout,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
