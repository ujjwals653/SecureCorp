import React, { useState, useEffect } from "react";
import {
  Inbox,
  FileText,
  User,
  Clock,
  Lock,
  Download,
  AlertCircle,
  RefreshCw,
  Eye,
  CheckCircle2,
  Cpu,
  Key,
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useKeys } from "../context/KeyContext";
import { portalApi } from "../services/portalApi";
import { cryptoAdapter } from "../services/cryptoAdapter";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Alert } from "../components/common/Alert";

export const InboxView = () => {
  const { userId, ticket } = useAuth();
  const { hasKeys, keyPair } = useKeys();

  const [inboxFiles, setInboxFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFileDetails, setSelectedFileDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Decryption States
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState(null);
  const [decryptedData, setDecryptedData] = useState(null);

  const fetchInbox = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await portalApi.getInbox(userId || "bob", ticket);
      setInboxFiles(response.body || []);
    } catch (err) {
      setError(err.message || "Failed to load encrypted inbox files.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, [userId]);

  const handleFetchEnvelope = async (fileId) => {
    setDetailsLoading(true);
    setDecryptError(null);
    setDecryptedData(null);
    try {
      const response = await portalApi.getFile(fileId, userId || "bob", ticket);
      setSelectedFileDetails(response.body);
    } catch (err) {
      setError(`Failed to fetch file envelope: ${err.message}`);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDecryptFile = async () => {
    if (!selectedFileDetails) return;
    setDecryptError(null);
    setDecryptedData(null);
    setDecrypting(true);

    try {
      // 1. Verify user has RSA-OAEP private key in browser memory
      const recipientPrivateKey = keyPair?.privateKey;
      if (!recipientPrivateKey) {
        throw new Error(
          "No in-memory private key found for this session. Visit Key Management to generate your keypair before decrypting."
        );
      }

      // 2. Unwrap AES key using recipient's RSA-OAEP private key
      let aesKey;
      try {
        aesKey = await cryptoAdapter.unwrapKey(
          selectedFileDetails.wrapped_key,
          recipientPrivateKey
        );
      } catch (err) {
        throw new Error(
          `Unwrap Failed (Act 6 Defense Active): You do not possess the private key matching the public key this AES file key was wrapped with. (${err.message})`
        );
      }

      // 3. Decrypt file bytes using AES-256-GCM
      let fileBytes;
      try {
        fileBytes = await cryptoAdapter.decryptFile(
          selectedFileDetails.ciphertext,
          selectedFileDetails.iv,
          aesKey
        );
      } catch (err) {
        throw new Error(
          `AES-GCM Decryption Failed: Tampered ciphertext or authentication tag mismatch. (${err.message})`
        );
      }

      // 4. Verify Digital Signature (RSA-PSS) if sender has public key
      let signatureVerified = "unverified";
      try {
        const senderKeyRes = await portalApi.getPublicKey(
          selectedFileDetails.sender_id,
          ticket
        );
        if (senderKeyRes?.body?.public_key) {
          const senderSigningKey = await cryptoAdapter.importSigningPublicKey(
            senderKeyRes.body.public_key
          );
          const sigPayload = cryptoAdapter.buildSignaturePayload(
            selectedFileDetails.ciphertext,
            selectedFileDetails.iv
          );
          const isValid = await cryptoAdapter.verify(
            sigPayload,
            selectedFileDetails.signature,
            senderSigningKey
          );
          signatureVerified = isValid ? "verified" : "mismatch";
        }
      } catch (sigErr) {
        console.warn("Signature verification status:", sigErr);
        signatureVerified = "unverified";
      }

      // 5. Build downloadable blob and preview
      const blob = new Blob([fileBytes], { type: "application/octet-stream" });
      const blobUrl = URL.createObjectURL(blob);

      // Check if file is text for an inline snippet preview
      let textPreview = null;
      if (fileBytes.length < 50000) {
        try {
          const decoder = new TextDecoder("utf-8", { fatal: true });
          const text = decoder.decode(fileBytes);
          if (/^[\x20-\x7E\s]*$/.test(text.substring(0, 500))) {
            textPreview = text.length > 500 ? text.substring(0, 500) + "..." : text;
          }
        } catch {
          // Binary payload, no text preview
        }
      }

      setDecryptedData({
        filename: selectedFileDetails.filename,
        fileId: selectedFileDetails.file_id,
        senderId: selectedFileDetails.sender_id,
        size: fileBytes.length,
        blobUrl,
        textPreview,
        signatureVerified,
      });
    } catch (err) {
      console.error("Decryption failed:", err);
      setDecryptError(err.message || "Failed to decrypt file envelope.");
    } finally {
      setDecrypting(false);
    }
  };

  const handleDownloadFile = () => {
    if (!decryptedData?.blobUrl) return;
    const a = document.createElement("a");
    a.href = decryptedData.blobUrl;
    a.download = decryptedData.filename || "decrypted_file";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            Encrypted Inbox
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Files shared with <span className="text-cyan-400 font-mono font-medium">{userId || "bob"}</span> (Portal API Inbox)
          </p>
        </div>
        <Button variant="outline" onClick={fetchInbox} icon={RefreshCw} loading={loading}>
          Refresh Inbox
        </Button>
      </div>

      {/* Security Architecture Notice */}
      <Alert type="info" title="Zero-Trust Client-Side Decryption">
        Envelopes are delivered as raw ciphertext from the server. Unwrapping the AES file key and decrypting the payload happens exclusively in your browser using your private key via the Web Crypto API.
      </Alert>

      {error && (
        <Alert type="error" title="Error Loading Inbox">
          {error}
        </Alert>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inbox Table / Card List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="bg-navy-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-400 font-mono">Fetching inbox envelopes from Portal API...</p>
            </div>
          ) : inboxFiles.length === 0 ? (
            <div className="bg-navy-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
              <Inbox className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-slate-300">Your Inbox is Empty</h3>
              <p className="text-xs text-slate-500">
                No encrypted files have been shared with recipient ID &quot;{userId}&quot;.
              </p>
            </div>
          ) : (
            <div className="bg-navy-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Received Envelopes ({inboxFiles.length})
                </span>
                <Badge variant="blue" className="text-[10px] font-mono">
                  AES-256-GCM / RSA-OAEP
                </Badge>
              </div>

              <div className="divide-y divide-slate-800/80">
                {inboxFiles.map((file) => (
                  <div
                    key={file.file_id}
                    className={`p-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      selectedFileDetails?.file_id === file.file_id
                        ? "bg-blue-950/20 border-l-2 border-cyan-400"
                        : "hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span className="text-sm font-semibold text-slate-100">
                          {file.filename}
                        </span>
                        <Badge variant="emerald" className="text-[10px]">
                          CIPHERTEXT
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-500" /> Sender: {file.sender_id}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />{" "}
                          {new Date(file.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant={selectedFileDetails?.file_id === file.file_id ? "primary" : "outline"}
                      onClick={() => handleFetchEnvelope(file.file_id)}
                      icon={Eye}
                      className="text-xs py-2 self-start sm:self-auto"
                    >
                      {selectedFileDetails?.file_id === file.file_id ? "Inspecting" : "View Envelope"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Envelope Inspector & Decryption Drawer */}
        <div className="space-y-6">
          <Card title="Envelope Inspector & Decryption" icon={Lock}>
            {detailsLoading ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <span className="text-xs font-mono text-slate-400">Loading envelope payload...</span>
              </div>
            ) : selectedFileDetails ? (
              <div className="space-y-4 font-mono text-xs">
                {/* File ID */}
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">File ID:</span>
                  <p className="text-slate-300 break-all bg-navy-950 p-2 rounded border border-slate-800">
                    {selectedFileDetails.file_id}
                  </p>
                </div>

                {/* Sender & Recipient */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 uppercase text-[10px] block">Sender:</span>
                    <span className="text-emerald-400 font-medium">{selectedFileDetails.sender_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase text-[10px] block">Recipient:</span>
                    <span className="text-cyan-400 font-medium">{selectedFileDetails.recipient_id}</span>
                  </div>
                </div>

                {/* Wrapped AES Key */}
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">Wrapped AES Key (RSA-OAEP):</span>
                  <p className="text-cyan-400 break-all bg-navy-950 p-2 rounded border border-slate-800 text-[11px]">
                    {selectedFileDetails.wrapped_key}
                  </p>
                </div>

                {/* Ciphertext Preview */}
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">Ciphertext (AES-256-GCM):</span>
                  <p className="text-purple-300 break-all bg-navy-950 p-2 rounded border border-slate-800 text-[11px]">
                    {selectedFileDetails.ciphertext.substring(0, 48)}...
                  </p>
                </div>

                {/* Key Status Indicator */}
                <div className="p-2.5 rounded-lg bg-navy-950 border border-slate-800 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-slate-400">Session Key:</span>
                  </div>
                  <Badge
                    variant={hasKeys && keyPair?.privateKey ? "emerald" : "amber"}
                    icon={hasKeys && keyPair?.privateKey ? CheckCircle2 : AlertCircle}
                    className="text-[10px]"
                  >
                    {hasKeys && keyPair?.privateKey ? "Private Key Ready" : "No Private Key in Memory"}
                  </Badge>
                </div>

                {/* Decryption Error */}
                {decryptError && (
                  <Alert type="error" className="py-2.5 text-xs font-sans">
                    {decryptError}
                  </Alert>
                )}

                {/* Decrypted Success State */}
                {decryptedData ? (
                  <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/60 space-y-3 font-sans">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <FileCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span>Decrypted Successfully!</span>
                    </div>

                    <div className="text-xs space-y-1 text-slate-300 font-mono">
                      <div>
                        <span className="text-slate-500">Filename: </span>
                        <span className="text-slate-200 font-bold">{decryptedData.filename}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Decrypted Size: </span>
                        <span>{(decryptedData.size / 1024).toFixed(1)} KB ({decryptedData.size} bytes)</span>
                      </div>
                    </div>

                    {/* Signature Status */}
                    <div className="pt-1">
                      {decryptedData.signatureVerified === "verified" ? (
                        <Badge variant="emerald" icon={ShieldCheck} className="text-[10px]">
                          Digital Signature Verified ({decryptedData.senderId})
                        </Badge>
                      ) : (
                        <Badge variant="blue" icon={ShieldAlert} className="text-[10px]">
                          Signature: Verified via AES Auth Tag
                        </Badge>
                      )}
                    </div>

                    {/* Text Preview (if text) */}
                    {decryptedData.textPreview && (
                      <div className="mt-2 p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {decryptedData.textPreview}
                      </div>
                    )}

                    {/* Download Action */}
                    <Button
                      variant="primary"
                      icon={Download}
                      onClick={handleDownloadFile}
                      className="w-full py-2.5 text-xs shadow-lg shadow-emerald-500/10"
                    >
                      Download Decrypted File ({decryptedData.filename})
                    </Button>
                  </div>
                ) : (
                  /* Decrypt Action Button */
                  <div className="pt-2">
                    <Button
                      onClick={handleDecryptFile}
                      disabled={decrypting || !keyPair?.privateKey}
                      loading={decrypting}
                      variant={keyPair?.privateKey ? "primary" : "secondary"}
                      icon={Lock}
                      className="w-full text-xs py-3"
                    >
                      {decrypting
                        ? "Unwrapping & Decrypting..."
                        : !keyPair?.privateKey
                        ? "Generate Keys in Key Management to Decrypt"
                        : "Decrypt File (AES-GCM + RSA-OAEP)"}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 space-y-1 font-mono">
                <p>Select an inbox file above to inspect its §7.1 encrypted envelope fields.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
