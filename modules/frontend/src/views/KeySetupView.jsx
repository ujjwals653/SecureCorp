import React, { useState } from "react";
import {
  Key,
  Shield,
  Info,
  AlertTriangle,
  Cpu,
  CheckCircle2,
  Lock,
  Check,
  RefreshCw,
  Database,
  ArrowRight,
  HardDrive,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useKeys } from "../context/KeyContext";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Alert } from "../components/common/Alert";

export const KeySetupView = () => {
  const {
    keyStatus,
    hasKeys,
    publicKeyBase64,
    serverPublicKeyBase64,
    registeredOnBackend,
    generateKeys,
    registerKeyOnBackend,
    syncKeys,
    loading: keysLoading,
    keyError,
    cryptoAvailable,
  } = useKeys();
  const { userId, ticket } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerateClick = async () => {
    setRegisterSuccess(false);
    setGenerating(true);
    await generateKeys();
    setGenerating(false);
  };

  const handleRegisterClick = async () => {
    if (!hasKeys || !userId) return;
    setRegistering(true);
    const result = await registerKeyOnBackend(userId, ticket);
    setRegistering(false);
    if (result.success) {
      setRegisterSuccess(true);
    }
  };

  const isSynchronized = Boolean(
    hasKeys &&
    registeredOnBackend &&
    publicKeyBase64 &&
    serverPublicKeyBase64 &&
    publicKeyBase64 === serverPublicKeyBase64
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Asymmetric Keypair Management
          </h1>
          <p className="text-sm text-body mt-1">
            Generate RSA keypairs in-browser and register public keys with Portal API
          </p>
        </div>
        <Button
          variant="outline"
          onClick={syncKeys}
          icon={RefreshCw}
          loading={keysLoading}
          className="text-xs"
        >
          Sync Keystore
        </Button>
      </div>

      {/* Sync Status Banners */}
      {isSynchronized && (
        <Alert type="success" title="Keystore Synchronized with Portal API">
          Your browser keystore (IndexedDB) holds the active private key, and your public key is confirmed registered on the Portal API for user &quot;{userId}&quot;.
        </Alert>
      )}

      {!hasKeys && serverPublicKeyBase64 && (
        <Alert type="warning" title="Server Key Present (No Local Private Key)">
          The Portal API has an active public key for user &quot;{userId}&quot;, but this browser does not hold the matching private key in its local keystore. Generating a new keypair and registering it will overwrite the server key.
        </Alert>
      )}

      {!cryptoAvailable && (
        <Alert type="error" title="Web Crypto API Unavailable">
          Web Crypto API is not accessible in this context. Key generation and cryptographic operations cannot proceed.
        </Alert>
      )}

      {keyError && (
        <Alert type="error" title="Keystore Error">
          {keyError}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Key Control */}
        <div className="md:col-span-2 space-y-6">
          <Card title="Client-Side Key Generation" icon={Key}>
            <div className="space-y-5">
              <p className="text-sm text-body leading-relaxed">
                Your browser generates an asymmetric <strong className="text-ink">RSA-OAEP-2048</strong> keypair for
                key wrapping and an <strong className="text-ink">RSA-PSS-2048</strong> keypair for digital signatures.
                Private keys are stored non-extractable in <strong className="text-ink">IndexedDB</strong>, surviving page reloads without exposing raw bytes.
              </p>

              <div className="p-4 rounded-xl bg-panel border border-line space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-body">Wrapping Key Algorithm:</span>
                  <span className="text-purple-600 font-semibold">RSA-OAEP-2048</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body">Signing Key Algorithm:</span>
                  <span className="text-purple-600 font-semibold">RSA-PSS-2048 / SHA-256</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body">Private Key Storage:</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> Browser IndexedDB (Non-extractable)
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-line">
                  <span className="text-body">Keystore Status:</span>
                  <Badge
                    variant={hasKeys ? "emerald" : "amber"}
                    icon={hasKeys ? CheckCircle2 : AlertTriangle}
                    className="text-[10px]"
                  >
                    {hasKeys ? "Keys Present in Local Keystore" : "No Keys in Local Keystore"}
                  </Badge>
                </div>
              </div>

              <Button
                onClick={handleGenerateClick}
                disabled={!cryptoAvailable || generating}
                loading={generating}
                variant={cryptoAvailable ? "primary" : "secondary"}
                icon={Key}
                className="w-full py-3 text-sm"
              >
                {generating
                  ? "Generating Keypairs in Browser..."
                  : hasKeys
                  ? "Regenerate Key Pair (Creates New Keys)"
                  : "Generate Key Pair"}
              </Button>
            </div>
          </Card>

          {/* Public Key Registration */}
          <Card title="Public Key Registration" icon={Shield}>
            <div className="space-y-4">
              <p className="text-sm text-body leading-relaxed">
                Your public key (Base64 SPKI) is published to the Portal API so other users
                (e.g., Alice) can fetch your public key and wrap file AES keys for you.
              </p>

              <div className="p-4 rounded-xl bg-panel border border-line text-xs min-h-[100px] flex items-center justify-center">
                {hasKeys && publicKeyBase64 ? (
                  <div className="space-y-2 text-left w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-muted text-[10px] uppercase font-medium">Active Public Key (Base64 SPKI):</span>
                      <Badge variant="purple" className="text-[10px]">RSA-OAEP-2048</Badge>
                    </div>
                    <span className="text-purple-700 break-all select-all text-[11px] leading-relaxed block bg-white p-2.5 rounded-lg border border-line">
                      {publicKeyBase64}
                    </span>
                  </div>
                ) : serverPublicKeyBase64 ? (
                  <div className="space-y-2 text-left w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-muted text-[10px] uppercase font-medium">Server Registered Key (No Local Private Key):</span>
                      <Badge variant="amber" className="text-[10px]">Server Only</Badge>
                    </div>
                    <span className="text-amber-700 break-all select-all text-[11px] leading-relaxed block bg-white p-2.5 rounded-lg border border-line">
                      {serverPublicKeyBase64}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted text-center text-xs">[ No Public Key Exported — Keypair Not Yet Generated ]</span>
                )}
              </div>

              {registerSuccess && (
                <Alert type="success" className="py-2.5 text-xs">
                  Public key successfully registered on Portal API for user &quot;{userId}&quot;!
                </Alert>
              )}

              <Button
                variant={hasKeys ? "primary" : "outline"}
                disabled={!hasKeys || registering}
                loading={registering}
                icon={registeredOnBackend || registerSuccess ? Check : Shield}
                onClick={handleRegisterClick}
                className="w-full text-xs py-3"
              >
                {registeredOnBackend || registerSuccess
                  ? "Public Key Registered on Server"
                  : hasKeys
                  ? `Register Public Key on Server (${userId || "Current User"})`
                  : "Register Public Key on Server (Generate Keys First)"}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Security Guarantees */}
        <div className="space-y-4">
          <Card title="Security Model" icon={Lock}>
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                <h4 className="font-semibold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Private Key Isolation
                </h4>
                <p className="text-body leading-tight">
                  Your private key never leaves your browser and is never transmitted to the server or database.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 space-y-1">
                <h4 className="font-semibold text-purple-700 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" /> Reload Persistence
                </h4>
                <p className="text-body leading-tight">
                  Non-extractable keys are preserved across page refreshes via browser IndexedDB.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                <h4 className="font-semibold text-blue-700 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Public Key Infrastructure
                </h4>
                <p className="text-body leading-tight">
                  Public keys are published via <code className="text-purple-600">POST /api/keys/register</code> so peers can encrypt for you.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                <h4 className="font-semibold text-amber-700 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> Web Crypto API Native
                </h4>
                <p className="text-body leading-tight">
                  All asymmetric operations are powered directly by browser hardware acceleration.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
