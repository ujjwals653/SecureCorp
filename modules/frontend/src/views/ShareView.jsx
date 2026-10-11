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
  const [currentStep, setCurrentStep] = useState(0);
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

      setCurrentStep(1);
      setStatusMessage("Reading file into browser memory buffer...");
      const fileBytes = await selectedFile.arrayBuffer();

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

      setCurrentStep(3);
      setStatusMessage("Encrypting payload (AES-256-GCM) and wrapping key (RSA-OAEP)...");
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

  // Helper to get step state styles
  const stepStyle = (step) => {
    if (loading && currentStep === step)
      return "bg-purple-50 border-purple-300";
    if (currentStep > step || uploadResult)
      return "bg-emerald-50 border-emerald-200";
    return "bg-panel border-line";
  };

  const stepIcon = (step) => {
    if (currentStep > step || uploadResult)
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (loading && currentStep === step)
      return <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />;
    return null;
  };

  const steps = [
    { num: 1, label: "Step 1: Read File",             color: "text-purple-600", desc: "Convert File to ArrayBuffer bytes in browser" },
    { num: 2, label: "Step 2: Fetch Recipient Key",   color: "text-blue-600",   desc: `GET /api/keys/${recipientId || ":user"} & import RSA-OAEP key` },
    { num: 3, label: "Step 3: AES-GCM Encrypt",       color: "text-body",       desc: "Generate 256-bit AES key & encrypt file payload" },
    { num: 4, label: "Step 4: RSA Wrap & Sign",       color: "text-emerald-600",desc: "RSA-OAEP wrap AES key & RSA-PSS sign (ciphertext ‖ iv)" },
    { num: 5, label: "Step 5: Post Envelope",         color: "text-amber-600",  desc: "POST /api/files/upload with §7.1 encrypted envelope" },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Encrypt & Share File</h1>
        <p className="text-sm text-body mt-1">
          Client-Side End-to-End Encryption Workflow (AES-256-GCM + RSA-OAEP-2048 + RSA-PSS Signature)
        </p>
      </div>

      {!cryptoAvailable && (
        <Alert type="warning" title="Web Crypto Unavailable">
          Web Crypto API is not accessible in this context. Client-side encryption cannot proceed.
        </Alert>
      )}

      {error && (
        <Alert type="error" title="Encryption or Upload Failed">
          {error}
        </Alert>
      )}

      {uploadResult && (
        <Alert type="success" title="File Successfully Encrypted & Stored on Portal API!">
          <div className="space-y-2 mt-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body">File ID:</span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {uploadResult.fileId}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
              <div><span className="text-body">Filename: </span><span className="text-ink">{uploadResult.filename}</span></div>
              <div><span className="text-body">Recipient: </span><span className="text-purple-700">{uploadResult.recipientId}</span></div>
              <div><span className="text-body">Sender: </span><span className="text-emerald-700">{uploadResult.senderId}</span></div>
              <div><span className="text-body">Timestamp: </span><span className="text-body">{uploadResult.timestamp}</span></div>
            </div>
            <div className="pt-1">
              <span className="text-muted text-[10px]">
                The envelope has been securely transmitted. Only {uploadResult.recipientId}&apos;s private RSA key can decrypt it.
              </span>
            </div>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 cols: Form */}
        <div className="md:col-span-2 space-y-6">
          <Card title="1. Select File to Encrypt" icon={Upload}>
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-line hover:border-purple-400 rounded-xl p-8 text-center transition-all bg-panel cursor-pointer"
              >
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer space-y-3 block">
                  <div className="p-3 rounded-full bg-purple-100 text-purple-600 w-fit mx-auto border border-purple-200">
                    <File className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-ink block">
                      Click to browse or drag & drop file here
                    </span>
                    <span className="text-xs text-body mt-1 block">
                      Any file format (PDF, DOCX, PNG, ZIP, TXT)
                    </span>
                  </div>
                </label>
              </div>

              {selectedFile && (
                <div className="p-4 rounded-xl bg-panel border border-line flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-5 h-5 text-emerald-500" />
                    <div>
                      <span className="text-sm font-medium text-ink block">{selectedFile.name}</span>
                      <span className="text-xs text-body">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || "binary"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setCurrentStep(0); }}
                    className="text-xs text-body hover:text-red-500 px-2 py-1 rounded bg-white border border-line transition-colors"
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
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                  Recipient User ID
                </label>
                <input
                  type="text"
                  id="recipient-id"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  placeholder="e.g. bob"
                  className="w-full px-4 py-2.5 bg-white border border-line rounded-lg text-sm text-ink placeholder-muted focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-all"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-body">
                    Frontend queries <code className="text-purple-600 bg-purple-50 px-1 rounded">GET /api/keys/{recipientId || ":user"}</code> for recipient public key.
                  </span>
                  <div className="flex gap-1.5">
                    {["bob", "alice"].map((name) => (
                      <button
                        key={name}
                        type="button"
                        id={`recipient-${name}`}
                        onClick={() => setRecipientId(name)}
                        className={`text-[10px] px-2 py-1 rounded-pill border transition-all font-medium ${
                          recipientId === name
                            ? "bg-purple-100 text-purple-700 border-purple-300"
                            : "bg-panel text-body border-line hover:text-ink"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sender Key Status Banner */}
              <div className="p-3 rounded-xl bg-panel border border-line flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-500" />
                  <span className="text-body">Sender Identity:</span>
                  <span className="text-ink font-semibold">{userId || "alice"}</span>
                </div>
                <Badge
                  variant={hasKeys ? "emerald" : "purple"}
                  icon={hasKeys ? CheckCircle2 : Sparkles}
                  className="text-[10px]"
                >
                  {hasKeys ? "Signing Key In-Memory" : "Auto-Generates Keypair"}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Action Button */}
          <div className="pt-1">
            <Button
              onClick={handleEncryptAndUpload}
              disabled={!selectedFile || !cryptoAvailable || loading}
              loading={loading}
              variant={cryptoAvailable ? "primary" : "secondary"}
              icon={Lock}
              className="w-full py-3.5 text-sm"
            >
              {loading
                ? statusMessage || "Encrypting & Uploading Envelope..."
                : cryptoAvailable
                ? "Encrypt & Upload Envelope"
                : "Crypto Unavailable in Browser"}
            </Button>
          </div>
        </div>

        {/* Right Column: Pipeline */}
        <div className="space-y-6">
          <Card
            title="Cryptographic Pipeline"
            subtitle="Live execution sequence via Crypto Core"
            icon={Cpu}
          >
            <div className="space-y-2.5 text-xs">
              {steps.map((s) => (
                <div
                  key={s.num}
                  className={`p-3 rounded-xl border transition-all space-y-1 ${stepStyle(s.num)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${s.color}`}>{s.label}</span>
                    {stepIcon(s.num)}
                  </div>
                  <p className="text-body text-[11px]">{s.desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
