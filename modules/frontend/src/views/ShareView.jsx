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
  CheckCircle2,
  Loader2,
  Sparkles,
  Key,
  Check,
} from "lucide-react";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Alert } from "../components/common/Alert";
import { useAuth } from "../context/AuthContext";
import { useKeys } from "../context/KeyContext";
import { portalApi } from "../services/portalApi";
import { cryptoAdapter } from "../services/cryptoAdapter";

export const ShareView = () => {
  const { userId, ticket } = useAuth();
  const { hasKeys, signingKeyPair, generateKeys } = useKeys();

  const [selectedFile, setSelectedFile] = useState(null);
  const [recipientId, setRecipientId] = useState("bob");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0: idle, 1..5: pipeline stages
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  const cryptoAvailable = cryptoAdapter.isAvailable();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
      setUploadResult(null);
      setCurrentStep(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError(null);
      setUploadResult(null);
      setCurrentStep(0);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleEncryptAndUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file to encrypt.");
      return;
    }
    if (!recipientId.trim()) {
      setError("Please specify a recipient User ID.");
      return;
    }
    if (!cryptoAvailable) {
      setError("Web Crypto API is not available in this browser environment.");
      return;
    }

    setLoading(true);
    setError(null);
    setUploadResult(null);

    try {
      // Step 0: Ensure sender has in-memory signing keypair
      let activeSigningKey = signingKeyPair?.privateKey;
      if (!activeSigningKey) {
        setStatusMessage("Initializing in-memory RSA keypair for digital signing...");
        const genRes = await generateKeys();
        if (!genRes.success || !genRes.keys?.signingKeyPair?.privateKey) {
          throw new Error(
            genRes.error || "Failed to generate in-memory keypair for signing."
          );
        }
        activeSigningKey = genRes.keys.signingKeyPair.privateKey;
      }

      // Step 1: Read File bytes into memory
      setCurrentStep(1);
      setStatusMessage("Reading file into browser memory buffer...");
      const fileBytes = await selectedFile.arrayBuffer();

      // Step 2: Fetch Recipient's Public RSA Key
      setCurrentStep(2);
      setStatusMessage(`Fetching public key for recipient "${recipientId.trim()}" from Portal API...`);
      const keyResponse = await portalApi.getPublicKey(recipientId.trim(), ticket);
      const recipientData = keyResponse.body;

      if (!recipientData || !recipientData.public_key) {
        throw new Error(
          `No public key found for recipient "${recipientId.trim()}". Ensure the user exists and has registered a key.`
        );
      }

      setStatusMessage("Importing recipient's RSA-OAEP wrapping key...");
      const recipientPublicKey = await cryptoAdapter.importEncryptionPublicKey(
        recipientData.public_key
      );

      // Step 3 & 4: AES-GCM Encrypt, RSA-OAEP Key Wrap, and RSA-PSS Digital Signature
      setCurrentStep(3);
      setStatusMessage("Encrypting payload (AES-256-GCM) and wrapping key (RSA-OAEP)...");

      // Give UI a microtick to render Step 3
      await new Promise((r) => setTimeout(r, 100));

      setCurrentStep(4);
      setStatusMessage("Generating cryptographic digital signature (RSA-PSS)...");

      const envelope = await cryptoAdapter.createEncryptedEnvelope({
        fileBytes,
        filename: selectedFile.name,
        senderId: userId || "alice",
        recipientId: recipientId.trim(),
        recipientPublicKey,
        signingPrivateKey: activeSigningKey,
      });

      // Step 5: Upload Encrypted Envelope to Portal API
      setCurrentStep(5);
      setStatusMessage("Uploading encrypted envelope (§7.1) to Portal API...");
      const uploadResponse = await portalApi.uploadFile(envelope, ticket);
      const uploadData = uploadResponse.body;

      setUploadResult({
        fileId: uploadData.file_id || envelope.file_id,
        filename: envelope.filename,
        senderId: envelope.sender_id,
        recipientId: envelope.recipient_id,
        timestamp: envelope.timestamp,
        ciphertextPreview: envelope.ciphertext.substring(0, 48) + "...",
        iv: envelope.iv,
        wrappedKeyPreview: envelope.wrapped_key.substring(0, 48) + "...",
        signaturePreview: envelope.signature.substring(0, 48) + "...",
      });

      setStatusMessage("");
      setSelectedFile(null);
    } catch (err) {
      console.error("Encrypt & Upload failure:", err);
      setError(err.message || "An error occurred during encryption and upload.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          Encrypt & Share File
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Client-Side End-to-End Encryption Workflow (AES-256-GCM + RSA-OAEP-2048 + RSA-PSS Signature)
        </p>
      </div>

      {/* Crypto Status Indicator */}
      {!cryptoAvailable && (
        <Alert type="warning" title="Web Crypto Unavailable">
          Web Crypto API is not accessible in this context. Client-side encryption cannot proceed.
        </Alert>
      )}

      {/* Error Feedback */}
      {error && (
        <Alert type="error" title="Encryption or Upload Failed">
          {error}
        </Alert>
      )}

      {/* Success Receipt Feedback */}
      {uploadResult && (
        <Alert type="success" title="File Successfully Encrypted & Stored on Portal API!">
          <div className="space-y-2 mt-2 font-mono text-xs text-slate-300">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400">File ID:</span>
              <span className="text-cyan-300 font-bold bg-navy-950 px-2 py-0.5 rounded border border-cyan-800/50">
                {uploadResult.fileId}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400">Filename: </span>
                <span className="text-slate-200">{uploadResult.filename}</span>
              </div>
              <div>
                <span className="text-slate-400">Recipient: </span>
                <span className="text-purple-300">{uploadResult.recipientId}</span>
              </div>
              <div>
                <span className="text-slate-400">Sender: </span>
                <span className="text-emerald-300">{uploadResult.senderId}</span>
              </div>
              <div>
                <span className="text-slate-400">Timestamp: </span>
                <span className="text-slate-400">{uploadResult.timestamp}</span>
              </div>
            </div>
            <div className="pt-2">
              <span className="text-slate-500 text-[10px] block">
                The envelope has been securely transmitted. Only {uploadResult.recipientId}&apos;s private RSA key can decrypt it.
              </span>
            </div>
          </div>
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
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setCurrentStep(0);
                    }}
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
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Frontend queries <code className="text-slate-400">GET /api/keys/{recipientId || ":user"}</code> for recipient public key.
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRecipientId("bob")}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
                        recipientId === "bob"
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                          : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400"
                      }`}
                    >
                      bob
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientId("alice")}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
                        recipientId === "alice"
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                          : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400"
                      }`}
                    >
                      alice
                    </button>
                  </div>
                </div>
              </div>

              {/* Sender Key Status Banner */}
              <div className="p-3 rounded-lg bg-navy-950 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <span className="text-slate-400">Sender Identity:</span>
                  <span className="text-slate-200 font-mono font-medium">{userId || "alice"}</span>
                </div>
                <Badge
                  variant={hasKeys ? "emerald" : "blue"}
                  icon={hasKeys ? CheckCircle2 : Sparkles}
                  className="text-[10px]"
                >
                  {hasKeys ? "Signing Key In-Memory" : "Auto-Generates Keypair"}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Encrypt & Upload Action Button */}
          <div className="pt-2">
            <Button
              onClick={handleEncryptAndUpload}
              disabled={!selectedFile || !cryptoAvailable || loading}
              loading={loading}
              variant={cryptoAvailable ? "primary" : "secondary"}
              icon={Lock}
              className="w-full py-3.5 text-base shadow-lg shadow-blue-500/10"
            >
              {loading
                ? statusMessage || "Encrypting & Uploading Envelope..."
                : cryptoAvailable
                ? "Encrypt & Upload Envelope"
                : "Crypto Unavailable in Browser"}
            </Button>
          </div>
        </div>

        {/* Right Column: Workflow Steps Visualization */}
        <div className="space-y-6">
          <Card
            title="Cryptographic Pipeline"
            subtitle="Live execution sequence via Crypto Core"
            icon={Cpu}
          >
            <div className="space-y-3 font-mono text-xs">
              {/* Step 1 */}
              <div
                className={`p-3 rounded-lg border transition-all space-y-1 ${
                  loading && currentStep === 1
                    ? "bg-blue-950/40 border-blue-500/60 shadow-md shadow-blue-500/10"
                    : currentStep > 1 || uploadResult
                    ? "bg-slate-950 border-emerald-800/40"
                    : "bg-slate-950 border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 font-semibold block">Step 1: Read File</span>
                  {currentStep > 1 || uploadResult ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : loading && currentStep === 1 ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-400">Convert File to ArrayBuffer bytes in browser</p>
              </div>

              {/* Step 2 */}
              <div
                className={`p-3 rounded-lg border transition-all space-y-1 ${
                  loading && currentStep === 2
                    ? "bg-blue-950/40 border-blue-500/60 shadow-md shadow-blue-500/10"
                    : currentStep > 2 || uploadResult
                    ? "bg-slate-950 border-emerald-800/40"
                    : "bg-slate-950 border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-blue-400 font-semibold block">Step 2: Fetch Recipient Key</span>
                  {currentStep > 2 || uploadResult ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : loading && currentStep === 2 ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-400">GET /api/keys/{recipientId || ":user"} & import RSA-OAEP key</p>
              </div>

              {/* Step 3 */}
              <div
                className={`p-3 rounded-lg border transition-all space-y-1 ${
                  loading && currentStep === 3
                    ? "bg-blue-950/40 border-blue-500/60 shadow-md shadow-blue-500/10"
                    : currentStep > 3 || uploadResult
                    ? "bg-slate-950 border-emerald-800/40"
                    : "bg-slate-950 border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-purple-400 font-semibold block">Step 3: AES-GCM Encrypt</span>
                  {currentStep > 3 || uploadResult ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : loading && currentStep === 3 ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-400">Generate 256-bit AES key & encrypt file payload</p>
              </div>

              {/* Step 4 */}
              <div
                className={`p-3 rounded-lg border transition-all space-y-1 ${
                  loading && currentStep === 4
                    ? "bg-blue-950/40 border-blue-500/60 shadow-md shadow-blue-500/10"
                    : currentStep > 4 || uploadResult
                    ? "bg-slate-950 border-emerald-800/40"
                    : "bg-slate-950 border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-semibold block">Step 4: RSA Wrap & Sign</span>
                  {currentStep > 4 || uploadResult ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : loading && currentStep === 4 ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-400">RSA-OAEP wrap AES key & RSA-PSS sign (ciphertext ‖ iv)</p>
              </div>

              {/* Step 5 */}
              <div
                className={`p-3 rounded-lg border transition-all space-y-1 ${
                  loading && currentStep === 5
                    ? "bg-blue-950/40 border-blue-500/60 shadow-md shadow-blue-500/10"
                    : uploadResult
                    ? "bg-slate-950 border-emerald-800/40"
                    : "bg-slate-950 border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-semibold block">Step 5: Post Envelope</span>
                  {uploadResult ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : loading && currentStep === 5 ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-400">POST /api/files/upload with §7.1 encrypted envelope</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
