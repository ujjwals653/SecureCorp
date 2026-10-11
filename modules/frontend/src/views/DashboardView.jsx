import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  User,
  Key,
  Share2,
  Inbox,
  Lock,
  ArrowRight,
  Server,
  FileCode,
  AlertCircle,
  Cpu,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useKeys } from "../context/KeyContext";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";

export const DashboardView = () => {
  const { userId, role, ticket, expiresAt } = useAuth();
  const { keyStatus, hasKeys, cryptoAvailable } = useKeys();

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          Security Control Center
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Zero-Trust Client-Side Cryptographic Workspace
        </p>
      </div>

      {/* Grid Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Identity */}
        <Card title="Authenticated Identity" icon={User}>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">User ID:</span>
              <span className="font-mono font-semibold text-slate-200">{userId || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">System Role:</span>
              <Badge variant="cyan" className="uppercase font-mono text-[10px]">
                {role || "employee"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Ticket Expiry:</span>
              <span className="text-xs font-mono text-slate-300">
                {expiresAt ? new Date(expiresAt).toLocaleTimeString() : "Session Active"}
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Encryption Property */}
        <Card title="Client Encryption" icon={Lock}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Client Cryptography (Integration Pending)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Files will be encrypted locally in your browser before upload once Crypto Core is connected. Server never receives plaintext or unwrapped keys.
            </p>
          </div>
        </Card>

        {/* Card 3: Keypair Status */}
        <Card title="Keypair Status" icon={Key}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Crypto Engine:</span>
              <Badge variant={cryptoAvailable ? "emerald" : "amber"} className="font-mono text-[10px]">
                {cryptoAvailable ? "READY" : "CRYPTO CORE PENDING"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Local Keypair:</span>
              <span className="text-xs font-mono text-slate-300">
                {hasKeys ? "Generated & Loaded" : "Not Configured"}
              </span>
            </div>
            <Link to="/keys">
              <Button variant="outline" className="w-full text-xs py-2 mt-1">
                Configure Keys
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-950/40 to-navy-900 border border-blue-900/50 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="p-3 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 w-fit mb-4">
              <Share2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100">Share Encrypted File</h3>
            <p className="text-sm text-slate-400 mt-1">
              Encrypt file payload using AES-GCM, wrap AES key with recipient's RSA-OAEP public key,
              sign envelope, and transmit ciphertext to Portal API.
            </p>
          </div>
          <Link to="/share" className="mt-6">
            <Button variant="primary" icon={ArrowRight} className="w-full">
              Open File Share Interface
            </Button>
          </Link>
        </div>

        <div className="bg-gradient-to-br from-cyan-950/40 to-navy-900 border border-cyan-900/50 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="p-3 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 w-fit mb-4">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100">Secure Inbox</h3>
            <p className="text-sm text-slate-400 mt-1">
              Fetch encrypted envelopes from Portal API, unwrap AES key using your RSA private key,
              verify signature, and decrypt file bytes in-browser.
            </p>
          </div>
          <Link to="/inbox" className="mt-6">
            <Button variant="secondary" icon={ArrowRight} className="w-full">
              View Received Files
            </Button>
          </Link>
        </div>
      </div>

      {/* Security Architecture Flowchart */}
      <Card title="Zero-Trust Architecture Diagram" subtitle="Client-Side Cryptographic Dataflow">
        <div className="p-6 rounded-xl bg-navy-950/80 border border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            {/* Step 1 */}
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 relative">
              <User className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <h4 className="text-xs font-semibold text-slate-200">1. Browser Client</h4>
              <p className="text-[11px] text-slate-400 mt-1">Alice selects plaintext file & recipient</p>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-lg bg-slate-900 border border-blue-900/60 relative">
              <Lock className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <h4 className="text-xs font-semibold text-cyan-300">2. Planned WebCrypto</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                AES-GCM Encrypt + RSA-OAEP Wrap + RSA-PSS Sign (Crypto Core)
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 relative">
              <FileCode className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <h4 className="text-xs font-semibold text-slate-200">3. JSON Envelope</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Only Base64 ciphertext, wrapped key & signature
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 relative">
              <Server className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <h4 className="text-xs font-semibold text-slate-200">4. Flask Backend</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Stores ciphertext only. Server cannot decrypt.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
