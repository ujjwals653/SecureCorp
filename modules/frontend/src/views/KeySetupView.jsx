import React from "react";
import { Key, Shield, Info, AlertTriangle, Cpu, CheckCircle2, Lock } from "lucide-react";
import { useKeys } from "../context/KeyContext";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Alert } from "../components/common/Alert";

export const KeySetupView = () => {
  const { keyStatus, hasKeys, generateKeys, keyError, cryptoAvailable } = useKeys();

  const handleGenerateClick = async () => {
    await generateKeys();
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          Asymmetric Keypair Management
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Generate RSA keypair in browser and register public key with Portal API
        </p>
      </div>

      {/* Crypto Core Connection Status Notice */}
      {!cryptoAvailable && (
        <Alert type="warning" title="Crypto Core Integration Pending">
          Cryptographic key generation algorithms are owned by{" "}
          <code className="text-amber-300 font-mono font-bold">modules/crypto-core</code>. In
          Phase 1, the frontend UI foundation is prepared and will consume real Crypto Core exports once the
          module is implemented. Web Crypto API is intentionally not called directly in the frontend component.
        </Alert>
      )}

      {keyError && (
        <Alert type="error" title="Key Generation Error">
          {keyError}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Key Control Panel */}
        <div className="md:col-span-2 space-y-6">
          <Card title="Client-Side Key Generation" icon={Key}>
            <div className="space-y-6">
              <p className="text-sm text-slate-300 leading-relaxed">
                Your browser will generate an asymmetric <strong>RSA-OAEP-2048</strong> keypair for
                key wrapping and an <strong>RSA-PSS</strong> keypair for digital signatures using the
                Web Crypto API via Crypto Core.
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
                  <span className="text-emerald-400">In-Memory (Volatile)</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  onClick={handleGenerateClick}
                  disabled={!cryptoAvailable}
                  variant={cryptoAvailable ? "primary" : "secondary"}
                  icon={Key}
                  className="w-full py-3 text-base"
                >
                  {cryptoAvailable ? "Generate Key Pair" : "Generate Key Pair (Crypto Core Pending)"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Public Key Registration Card */}
          <Card title="Public Key Registration" icon={Shield}>
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Once generated, your public key (Base64 SPKI) is published to the Portal API so other users
                (e.g., Alice) can fetch your public key and wrap file AES keys for you.
              </p>

              <div className="p-4 rounded-xl bg-navy-950 border border-slate-800 text-xs font-mono text-slate-500 min-h-[100px] flex items-center justify-center text-center">
                {hasKeys ? (
                  <span className="text-slate-300 break-all">
                    Public Key Base64 string will be rendered here.
                  </span>
                ) : (
                  <span>[ No Public Key Exported — Keypair Not Yet Generated ]</span>
                )}
              </div>

              <Button variant="outline" disabled className="w-full text-xs">
                Register Public Key on Server (Pending Keys)
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
                  Your private key never leaves browser memory and is never uploaded to the server or database.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/50 space-y-1">
                <h4 className="font-semibold text-blue-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Public Key Infrastructure
                </h4>
                <p className="text-slate-400 leading-tight">
                  Public keys are published via <code className="font-mono text-cyan-300">POST /api/keys/register</code>.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-900/50 space-y-1">
                <h4 className="font-semibold text-purple-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> Module Ownership
                </h4>
                <p className="text-slate-400 leading-tight">
                  Crypto Core owns WebCrypto calls. Frontend invokes exported functions via adapter layer.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
