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
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            Asymmetric Keypair Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
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

      {/* Sync Status Banner */}
      {isSynchronized && (
        <Alert type="success" title="Keystore Synchronized with Portal API">
          Your browser keystore (IndexedDB) holds the active private key, and your public key is confirmed registered on the Portal API for user &quot;{userId}&quot;.
        </Alert>
      )}

      {!hasKeys && serverPublicKeyBase64 && (
        <Alert type="warning" title="Server Key Present (No Local Private Key)">
          The Portal API has an active public key for user &quot;{userId}&quot;, but this browser does not hold the matching private key in its local keystore. Generating a new keypair and registering it will overwrite the server key with your new keypair.
        </Alert>
      )}

      {/* Crypto Core Status Notice */}
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
        {/* Left Column: Key Control Panel */}
        <div className="md:col-span-2 space-y-6">
          <Card title="Client-Side Key Generation" icon={Key}>
            <div className="space-y-6">
              <p className="text-sm text-slate-300 leading-relaxed">
                Your browser generates an asymmetric <strong>RSA-OAEP-2048</strong> keypair for
                key wrapping and an <strong>RSA-PSS-2048</strong> keypair for digital signatures.
                Private keys are stored non-extractable in <strong>IndexedDB</strong>, surviving page reloads without exposing raw bytes.
              </p>

              <div className="p-4 rounded-xl bg-navy-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Wrapping Key Algorithm:</span>
                  <span className="text-cyan-400">RSA-OAEP-2048</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Signing Key Algorithm:</span>
                  <span className="text-cyan-400">RSA-PSS-2048 / SHA-256</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Private Key Storage:</span>
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> Browser IndexedDB (Non-extractable)
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">Keystore Status:</span>
                  <Badge
                    variant={hasKeys ? "emerald" : "amber"}
                    icon={hasKeys ? CheckCircle2 : AlertTriangle}
                    className="text-[10px]"
                  >
                    {hasKeys ? "Keys Present in Local Keystore" : "No Keys in Local Keystore"}
                  </Badge>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  onClick={handleGenerateClick}
                  disabled={!cryptoAvailable || generating}
                  loading={generating}
                  variant={cryptoAvailable ? "primary" : "secondary"}
                  icon={Key}
                  className="w-full py-3 text-base shadow-lg shadow-blue-500/10"
                >
                  {generating
                    ? "Generating Keypairs in Browser..."
                    : hasKeys
                    ? "Regenerate Key Pair (Creates New Keys)"
                    : "Generate Key Pair"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Public Key Registration Card */}
          <Card title="Public Key Registration" icon={Shield}>
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Your public key (Base64 SPKI) is published to the Portal API so other users
                (e.g., Alice) can fetch your public key and wrap file AES keys for you.
              </p>

              <div className="p-4 rounded-xl bg-navy-950 border border-slate-800 text-xs font-mono text-slate-400 min-h-[100px] flex items-center justify-center text-center">
                {hasKeys && publicKeyBase64 ? (
                  <div className="space-y-2 text-left w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[10px] uppercase">Active Public Key (Base64 SPKI):</span>
                      <Badge variant="cyan" className="text-[10px]">RSA-OAEP-2048</Badge>
                    </div>
                    <span className="text-cyan-300 break-all select-all font-mono text-[11px] leading-relaxed block bg-slate-900 p-2.5 rounded border border-slate-800/80">
                      {publicKeyBase64}
                    </span>
                  </div>
                ) : serverPublicKeyBase64 ? (
                  <div className="space-y-2 text-left w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[10px] uppercase">Server Registered Key (No Local Private Key):</span>
                      <Badge variant="amber" className="text-[10px]">Server Only</Badge>
                    </div>
                    <span className="text-amber-300/80 break-all select-all font-mono text-[11px] leading-relaxed block bg-slate-900 p-2.5 rounded border border-slate-800/80">
                      {serverPublicKeyBase64}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500">[ No Public Key Exported — Keypair Not Yet Generated ]</span>
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
        <div className="space-y-6">
          <Card title="Security Model" icon={Lock}>
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-900/50 space-y-1">
                <h4 className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Private Key Isolation
                </h4>
                <p className="text-slate-400 leading-tight">
                  Your private key never leaves your browser and is never transmitted to the server or database.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-900/50 space-y-1">
                <h4 className="font-semibold text-cyan-300 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" /> Reload Persistence
                </h4>
                <p className="text-slate-400 leading-tight">
                  Non-extractable keys are preserved across page refreshes via browser IndexedDB.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/50 space-y-1">
                <h4 className="font-semibold text-blue-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Public Key Infrastructure
                </h4>
                <p className="text-slate-400 leading-tight">
                  Public keys are published via <code className="font-mono text-cyan-300">POST /api/keys/register</code> so peers can encrypt for you.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-900/50 space-y-1">
                <h4 className="font-semibold text-purple-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> Web Crypto API Native
                </h4>
                <p className="text-slate-400 leading-tight">
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
