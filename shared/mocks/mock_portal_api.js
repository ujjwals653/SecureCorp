/**
 * MOCK — Portal API response stubs.
 *
 * Real module: modules/backend (see modules/backend/AGENT.md)
 * Used by: modules/frontend, until Integration Checkpoint 3.
 *
 * Swap instructions:
 *   Replace calls to these mock functions with real `fetch()` calls to
 *   the endpoints documented in PROJECT_CONTEXT.md §8. Keep every call
 *   site isolated (e.g. behind a single `api.js` wrapper) so swapping
 *   is a one-line change per function, not a rewrite.
 *
 * All response shapes below match PROJECT_CONTEXT.md §7 and §8 exactly.
 */

// MOCK — replace with POST /api/auth/login
export async function mockLogin(userId, password) {
  return {
    status: 200,
    body: {
      ticket: `test-${userId}-ticket`,
      user_id: userId,
      role: "employee",
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    },
  };
}

// MOCK — replace with POST /api/keys/register
export async function mockRegisterKey(userId, publicKeyBase64, algorithm) {
  return {
    status: 200,
    body: { status: "registered", user_id: userId },
  };
}

// MOCK — replace with GET /api/keys/<user_id>
export async function mockGetPublicKey(userId) {
  return {
    status: 200,
    body: {
      user_id: userId,
      public_key: "MOCK-PUBLIC-KEY-BASE64-PLACEHOLDER",
      algorithm: "RSA-OAEP-2048",
      cert: null,
    },
  };
}

// MOCK — replace with POST /api/files/upload
export async function mockUploadFile(envelope) {
  return {
    status: 200,
    body: { file_id: envelope.file_id, status: "stored" },
  };
}

// MOCK — replace with GET /api/files/<file_id>
export async function mockGetFile(fileId, callerUserId) {
  // Simulates RBAC: only returns the envelope if callerUserId is sender or recipient.
  // Real Backend enforces this server-side — do not rely on this mock's check
  // as a stand-in for a real RBAC test, it's for UI flow development only.
  return {
    status: 200,
    body: {
      file_id: fileId,
      sender_id: "alice",
      recipient_id: "bob",
      ciphertext: "MOCK-CIPHERTEXT-PLACEHOLDER",
      iv: "MOCK-IV-PLACEHOLDER",
      wrapped_key: "MOCK-WRAPPED-KEY-PLACEHOLDER",
      signature: "MOCK-SIGNATURE-PLACEHOLDER",
      filename: "quarterly_report.pdf",
      timestamp: new Date().toISOString(),
    },
  };
}

// MOCK — replace with GET /api/files/inbox
export async function mockGetInbox(callerUserId) {
  return {
    status: 200,
    body: [
      {
        file_id: "550e8400-e29b-41d4-a716-446655440000",
        sender_id: "alice",
        filename: "quarterly_report.pdf",
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
