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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { portalApi } from "../services/portalApi";
import { cryptoAdapter } from "../services/cryptoAdapter";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Alert } from "../components/common/Alert";

export const InboxView = () => {
  const { userId, ticket } = useAuth();
  const [inboxFiles, setInboxFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFileDetails, setSelectedFileDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

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
    try {
      const response = await portalApi.getFile(fileId, userId || "bob", ticket);
      setSelectedFileDetails(response.body);
    } catch (err) {
      setError(`Failed to fetch file envelope: ${err.message}`);
    } finally {
      setDetailsLoading(false);
    }
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
            Files shared with <span className="text-cyan-400 font-mono">{userId || "bob"}</span> (Portal API Inbox)
          </p>
        </div>
        <Button variant="outline" onClick={fetchInbox} icon={RefreshCw} loading={loading}>
          Refresh Inbox
        </Button>
      </div>

      {/* Notice */}
      <Alert type="info" title="Phase 1 — Mock Inbox Connected">
        Connected to <code className="font-mono text-cyan-300">portalApi.getInbox()</code>. In Phase 2/3, selecting a file envelope will unwrap its AES key using your RSA private key via Crypto Core and decrypt the file payload directly in your browser.
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
                No encrypted files have been shared with recipient ID "{userId}".
              </p>
            </div>
          ) : (
            <div className="bg-navy-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Received Envelopes ({inboxFiles.length})
                </span>
                <Badge variant="blue" className="text-[10px] font-mono">
                  AES-GCM / RSA-OAEP
                </Badge>
              </div>

              <div className="divide-y divide-slate-800/80">
                {inboxFiles.map((file) => (
                  <div
                    key={file.file_id}
                    className="p-5 hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                      variant="outline"
                      onClick={() => handleFetchEnvelope(file.file_id)}
                      icon={Eye}
                      className="text-xs py-2 self-start sm:self-auto"
                    >
                      View Envelope
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Envelope Inspector Drawer */}
        <div className="space-y-6">
          <Card title="Envelope Inspector" icon={Lock}>
            {detailsLoading ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <span className="text-xs font-mono text-slate-400">Loading envelope payload...</span>
              </div>
            ) : selectedFileDetails ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">File ID:</span>
                  <p className="text-slate-300 break-all bg-navy-950 p-2 rounded border border-slate-800">
                    {selectedFileDetails.file_id}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">Wrapped AES Key:</span>
                  <p className="text-cyan-400 break-all bg-navy-950 p-2 rounded border border-slate-800 text-[11px]">
                    {selectedFileDetails.wrapped_key}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">Ciphertext Preview:</span>
                  <p className="text-purple-300 break-all bg-navy-950 p-2 rounded border border-slate-800 text-[11px]">
                    {selectedFileDetails.ciphertext.substring(0, 40)}...
                  </p>
                </div>

                <div className="pt-2">
                  <Button disabled variant="secondary" icon={Lock} className="w-full text-xs py-2.5">
                    Decrypt File (Crypto Core Pending)
                  </Button>
                </div>
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
