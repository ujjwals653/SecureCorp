import React, { useState } from "react";
import {
  Share2,
  Upload,
  File,
  UserCheck,
  Lock,
  FileCheck,
  AlertTriangle,
  Cpu,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Alert } from "../components/common/Alert";
import { cryptoAdapter } from "../services/cryptoAdapter";

export const ShareView = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [recipientId, setRecipientId] = useState("bob");
  const cryptoAvailable = cryptoAdapter.isAvailable();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          Encrypt & Share File
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Alice's Client-Side Encryption Workflow (AES-GCM + RSA-OAEP + RSA-PSS Signature)
        </p>
      </div>

      {/* Crypto Core Integration Notice */}
      {!cryptoAvailable && (
        <Alert type="info" title="Phase 1 UI Foundation — Crypto Core Connection Point">
          File encryption, key wrapping, and signing functions will be connected to{" "}
          <code className="text-cyan-300 font-mono font-bold">modules/crypto-core</code> exports in
          Phase 2. This interface demonstrates the complete file selection, recipient targeting, and envelope
          packaging layout.
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Columns: Share Form */}
        <div className="md:col-span-2 space-y-6">
          <Card title="1. Select File to Encrypt" icon={Upload}>
            <div className="space-y-4">
              {/* Drag & Drop Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-xl p-8 text-center transition-all bg-navy-950/60 cursor-pointer"
              >
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer space-y-3 block">
                  <div className="p-3 rounded-full bg-blue-500/10 text-blue-400 w-fit mx-auto border border-blue-500/20">
                    <File className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-200 block">
                      Click to browse or drag & drop file here
                    </span>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Any file format (PDF, DOCX, PNG, ZIP, TXT)
                    </span>
                  </div>
                </label>
              </div>

              {/* Selected File Card */}
              {selectedFile && (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="text-sm font-medium text-slate-200 block">
                        {selectedFile.name}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || "binary"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-slate-400 hover:text-red-400 font-mono px-2 py-1 rounded bg-slate-950 border border-slate-800"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </Card>

          {/* Recipient Selection */}
          <Card title="2. Select Recipient Target" icon={UserCheck}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Recipient User ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    placeholder="e.g. bob"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                  Frontend will query Portal API (<code className="text-slate-400">GET /api/keys/{recipientId}</code>) to fetch Bob's public RSA key.
                </span>
              </div>
            </div>
          </Card>

          {/* Encrypt & Upload Action Button */}
          <div className="pt-2">
            <Button
              disabled={!selectedFile || !cryptoAvailable}
              variant={cryptoAvailable ? "primary" : "secondary"}
              icon={Lock}
              className="w-full py-3.5 text-base"
            >
              {cryptoAvailable
                ? "Encrypt & Upload Envelope"
                : "Encrypt & Upload (Crypto Core Integration Pending)"}
            </Button>
          </div>
        </div>

        {/* Right Column: Workflow Steps Visualization */}
        <div className="space-y-6">
          <Card title="Planned Cryptographic Pipeline" subtitle="Target execution sequence via Crypto Core" icon={Cpu}>
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-cyan-400 font-semibold block">Step 1 (Planned): Read File</span>
                <p className="text-[11px] text-slate-400">Convert File to ArrayBuffer bytes in browser</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-blue-400 font-semibold block">Step 2 (Planned): AES-GCM Encrypt</span>
                <p className="text-[11px] text-slate-400">Generate AES key & encrypt file payload via Crypto Core</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-purple-400 font-semibold block">Step 3 (Planned): RSA Key Wrap</span>
                <p className="text-[11px] text-slate-400">Wrap AES key with Bob's public RSA-OAEP key via Crypto Core</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-emerald-400 font-semibold block">Step 4 (Planned): Digital Signature</span>
                <p className="text-[11px] text-slate-400">Sign ciphertext + IV with Alice's RSA private key via Crypto Core</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-amber-400 font-semibold block">Step 5 (Planned): JSON Envelope</span>
                <p className="text-[11px] text-slate-400">POST envelope to Portal API endpoint</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
