/**
 * Portal API Service Layer — SecureCorp Frontend
 * 
 * Single API boundary for the React frontend application.
 * Switches between shared mock implementations (shared/mocks/mock_portal_api.js)
 * and real Flask Backend REST endpoints (http://localhost:5000/api).
 */

import {
  mockLogin,
  mockRegisterKey,
  mockGetPublicKey,
  mockUploadFile,
  mockGetFile,
  mockGetInbox,
} from "../../../../shared/mocks/mock_portal_api.js";

// Toggle between mock and real API mode (default: mock mode for early dev / Checkpoints 1-2)
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export const isMockMode = () => USE_MOCK;

/**
 * Helper to execute fetch request with Auth ticket header
 */
async function request(endpoint, options = {}, ticket = null) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (ticket) {
    headers["Authorization"] = `Bearer ${ticket}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }
  return { status: response.status, body: data };
}

export const portalApi = {
  /**
   * Auth Login
   * POST /api/auth/login
   */
  async login(userId, password) {
    if (USE_MOCK) {
      // MOCK — replace with real POST /api/auth/login at Checkpoint 3
      return await mockLogin(userId, password);
    }
    return await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, password }),
    });
  },

  /**
   * Register Public Key
   * POST /api/keys/register
   */
  async registerKey(userId, publicKeyBase64, algorithm = "RSA-OAEP-2048", ticket = null) {
    if (USE_MOCK) {
      // MOCK — replace with real POST /api/keys/register at Checkpoint 3
      return await mockRegisterKey(userId, publicKeyBase64, algorithm);
    }
    return await request(
      "/keys/register",
      {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          public_key: publicKeyBase64,
          algorithm,
        }),
      },
      ticket
    );
  },

  /**
   * Fetch User Public Key
   * GET /api/keys/<user_id>
   */
  async getPublicKey(userId, ticket = null) {
    if (USE_MOCK) {
      // MOCK — replace with real GET /api/keys/<user_id> at Checkpoint 3
      return await mockGetPublicKey(userId);
    }
    return await request(`/keys/${encodeURIComponent(userId)}`, { method: "GET" }, ticket);
  },

  /**
   * Upload Encrypted Envelope
   * POST /api/files/upload
   */
  async uploadFile(envelope, ticket = null) {
    if (USE_MOCK) {
      // MOCK — replace with real POST /api/files/upload at Checkpoint 3
      return await mockUploadFile(envelope);
    }
    return await request(
      "/files/upload",
      {
        method: "POST",
        body: JSON.stringify(envelope),
      },
      ticket
    );
  },

  /**
   * Fetch Encrypted File Envelope
   * GET /api/files/<file_id>
   */
  async getFile(fileId, callerUserId, ticket = null) {
    if (USE_MOCK) {
      // MOCK — replace with real GET /api/files/<file_id> at Checkpoint 3
      return await mockGetFile(fileId, callerUserId);
    }
    return await request(`/files/${encodeURIComponent(fileId)}`, { method: "GET" }, ticket);
  },

  /**
   * Fetch Received File Inbox
   * GET /api/files/inbox
   */
  async getInbox(callerUserId, ticket = null) {
    if (USE_MOCK) {
      // MOCK — replace with real GET /api/files/inbox at Checkpoint 3
      return await mockGetInbox(callerUserId);
    }
    return await request("/files/inbox", { method: "GET" }, ticket);
  },
};
