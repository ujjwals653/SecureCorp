import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, User, ArrowRight, AlertCircle, Cpu, CheckCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Alert } from "../components/common/Alert";

export const LoginView = () => {
  const [username, setUsername] = useState("alice");
  const [password, setPassword] = useState("password123");
  const { login, loading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    clearError();
    const result = await login(username.trim(), password);
    if (result.success) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Subtle Background Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Branding Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 mb-4 shadow-lg shadow-blue-500/10">
            <Shield className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-wider">SECURECORP</h1>
          <p className="text-xs uppercase font-mono text-cyan-400 tracking-widest mt-1">
            Enterprise Zero-Trust Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-navy-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Authenticate Session</h2>
              <p className="text-xs text-slate-400 mt-0.5">Enter credentials to acquire Auth Ticket</p>
            </div>
            <Badge variant="blue" icon={Cpu} className="text-[11px] font-mono">
              Mock Portal API
            </Badge>
          </div>

          {error && (
            <Alert type="error" className="mb-6">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                User ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alice, bob"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password / Passphrase
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Quick Demo User Presets */}
            <div className="pt-2">
              <span className="text-[11px] font-mono text-slate-500 block mb-1.5">
                Quick Demo Presets:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUsername("alice")}
                  className={`text-xs font-mono px-3 py-1 rounded border transition-all ${
                    username === "alice"
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  alice (Sender)
                </button>
                <button
                  type="button"
                  onClick={() => setUsername("bob")}
                  className={`text-xs font-mono px-3 py-1 rounded border transition-all ${
                    username === "bob"
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  bob (Recipient)
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              icon={ArrowRight}
              className="w-full py-3 mt-4 text-base"
            >
              Sign In to SecureCorp
            </Button>
          </form>
        </div>

        {/* Security Architecture Note */}
        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5 font-mono">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Client-Side End-to-End Cryptography Architecture</span>
        </div>
      </div>
    </div>
  );
};
