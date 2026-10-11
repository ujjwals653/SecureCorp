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
      <div className="pb-2">
        <h1 className="text-2xl font-bold text-ink">
          Security Control Center
        </h1>
        <p className="text-sm text-body mt-1">
          Zero-Trust Client-Side Cryptographic Workspace
        </p>
      </div>

      {/* Grid Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Identity */}
        <Card title="Authenticated Identity" icon={User}>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-body">User ID:</span>
              <span className="font-semibold text-ink">{userId || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-body">System Role:</span>
              <Badge variant="purple" className="uppercase text-[10px]">
                {role || "employee"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-body">Ticket Expiry:</span>
              <span className="text-xs text-body">
                {expiresAt ? new Date(expiresAt).toLocaleTimeString() : "Session Active"}
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Encryption Property */}
        <Card title="Client Encryption" icon={Lock}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Client Cryptography (Integration Pending)</span>
            </div>
            <p className="text-xs text-body leading-relaxed">
              Files will be encrypted locally in your browser before upload once Crypto Core is connected. Server never receives plaintext or unwrapped keys.
            </p>
          </div>
        </Card>

        {/* Card 3: Keypair Status */}
        <Card title="Keypair Status" icon={Key}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-body">Crypto Engine:</span>
              <Badge variant={cryptoAvailable ? "emerald" : "amber"} className="text-[10px]">
                {cryptoAvailable ? "READY" : "CRYPTO CORE PENDING"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-body">Local Keypair:</span>
              <span className="text-xs text-body">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Share File */}
        <div className="bg-white border border-line rounded-xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
          <div>
            <div className="p-3 rounded-xl bg-purple-100 text-purple-600 border border-purple-200 w-fit mb-4">
              <Share2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-ink">Share Encrypted File</h3>
            <p className="text-sm text-body mt-1.5 leading-relaxed">
              Encrypt file payload using AES-GCM, wrap AES key with recipient's RSA-OAEP public key,
              sign envelope, and transmit ciphertext to Portal API.
            </p>
          </div>
          <Link to="/share" className="mt-5">
            <Button variant="primary" icon={ArrowRight} className="w-full">
              Open File Share Interface
            </Button>
          </Link>
        </div>

        {/* Secure Inbox */}
        <div className="bg-white border border-line rounded-xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
          <div>
            <div className="p-3 rounded-xl bg-purple-100 text-purple-600 border border-purple-200 w-fit mb-4">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-ink">Secure Inbox</h3>
            <p className="text-sm text-body mt-1.5 leading-relaxed">
              Fetch encrypted envelopes from Portal API, unwrap AES key using your RSA private key,
              verify signature, and decrypt file bytes in-browser.
            </p>
          </div>
          <Link to="/inbox" className="mt-5">
            <Button variant="outline" icon={ArrowRight} className="w-full">
              View Received Files
            </Button>
          </Link>
        </div>
      </div>

      {/* Architecture Flowchart */}
      <Card title="Zero-Trust Architecture Diagram" subtitle="Client-Side Cryptographic Dataflow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-panel border border-line">
            <User className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <h4 className="text-xs font-semibold text-ink">1. Browser Client</h4>
            <p className="text-[11px] text-body mt-1">Alice selects plaintext file & recipient</p>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
            <Lock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <h4 className="text-xs font-semibold text-purple-700">2. Planned WebCrypto</h4>
            <p className="text-[11px] text-body mt-1">
              AES-GCM Encrypt + RSA-OAEP Wrap + RSA-PSS Sign (Crypto Core)
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-panel border border-line">
            <FileCode className="w-6 h-6 text-body mx-auto mb-2" />
            <h4 className="text-xs font-semibold text-ink">3. JSON Envelope</h4>
            <p className="text-[11px] text-body mt-1">
              Only Base64 ciphertext, wrapped key & signature
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-xl bg-panel border border-line">
            <Server className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-xs font-semibold text-ink">4. Flask Backend</h4>
            <p className="text-[11px] text-body mt-1">
              Stores ciphertext only. Server cannot decrypt.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
