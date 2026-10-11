import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, User, ArrowRight, AlertCircle, Cpu, CheckCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Alert } from "../components/common/Alert";

// Crystal SVG art from Fairdrop index.html (purple polygon art)
const CrystalArt = () => (
  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="cg1" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#a264ff"/>
        <stop offset="1" stopColor="#35107f"/>
      </linearGradient>
      <linearGradient id="cg2" x1="0" y1="1" x2="1" y2="0">
        <stop stopColor="#170b4f"/>
        <stop offset="1" stopColor="#872dcb"/>
      </linearGradient>
      <linearGradient id="cg3" x1="0" y1="0" x2="0.8" y2="1">
        <stop stopColor="#e45af4"/>
        <stop offset="1" stopColor="#5a20d8"/>
      </linearGradient>
    </defs>
    <rect width="600" height="900" fill="#24105d"/>
    <g stroke="#ffffff" strokeOpacity=".12" strokeWidth="1">
      <polygon points="0,0 175,0 120,185 0,230" fill="url(#cg1)"/>
      <polygon points="175,0 350,0 280,210 120,185" fill="#5d24bd"/>
      <polygon points="350,0 600,0 480,180 280,210" fill="url(#cg2)"/>
      <polygon points="0,230 120,185 215,360 50,470" fill="#351178"/>
      <polygon points="120,185 280,210 215,360" fill="url(#cg3)"/>
      <polygon points="280,210 480,180 420,370 215,360" fill="#6c28d3"/>
      <polygon points="480,180 600,0 600,350 420,370" fill="#35116f"/>
      <polygon points="0,230 50,470 0,610" fill="#752ec0"/>
      <polygon points="50,470 215,360 280,550 120,690" fill="url(#cg1)"/>
      <polygon points="215,360 420,370 280,550" fill="#2b176c"/>
      <polygon points="420,370 600,350 520,570 280,550" fill="url(#cg3)"/>
      <polygon points="600,350 600,640 520,570" fill="#280f64"/>
      <polygon points="0,610 120,690 90,900 0,900" fill="#2f146e"/>
      <polygon points="120,690 280,550 350,765 90,900" fill="url(#cg2)"/>
      <polygon points="280,550 520,570 500,790 350,765" fill="#7128bb"/>
      <polygon points="520,570 600,640 600,900 500,790" fill="url(#cg1)"/>
      <polygon points="350,765 500,790 600,900 90,900" fill="#45138e"/>
    </g>
    <g opacity=".22" fill="#eab5ff">
      <path d="M100 0 173 0 122 185 70 120Z"/>
      <path d="M280 210 350 0 385 100Z"/>
      <path d="M420 370 480 180 510 275Z"/>
      <path d="M50 470 120 690 88 634Z"/>
      <path d="M280 550 420 370 375 520Z"/>
    </g>
  </svg>
);

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
    <div className="min-h-screen bg-panel flex items-center justify-center p-6">
      {/* Auth Card — split layout like Fairdrop */}
      <div className="w-full max-w-[860px] min-h-[540px] grid grid-cols-1 md:grid-cols-[42%_58%] bg-white border border-line rounded-2xl overflow-hidden shadow-lg">

        {/* Left Art Panel */}
        <div className="relative overflow-hidden bg-purple-900 min-h-[220px] md:min-h-full">
          <CrystalArt />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(21,4,61,0.6)] to-transparent" />
          {/* Copy */}
          <div className="absolute z-10 bottom-8 left-8 right-6 text-white">
            <p className="text-xl font-semibold leading-snug tracking-tight max-w-[260px]">
              Secure, Zero-Trust enterprise file transfer
            </p>
            <p className="text-sm text-purple-200 mt-2 opacity-90">
              Client-side end-to-end cryptography
            </p>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex flex-col justify-center p-8 md:p-10">
          {/* Top line */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-100 text-purple-600 border border-purple-200">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="block font-bold text-ink text-lg tracking-wider leading-tight">SECURECORP</span>
                <span className="block text-[10px] uppercase text-body tracking-widest">Enterprise Zero-Trust Portal</span>
              </div>
            </div>
            <Badge variant="purple" icon={Cpu} className="text-[10px] font-medium">
              Mock Portal API
            </Badge>
          </div>

          <div className="border-b border-line mb-6 pb-4">
            <h2 className="text-base font-semibold text-ink">Authenticate Session</h2>
            <p className="text-xs text-body mt-0.5">Enter credentials to acquire your Auth Ticket</p>
          </div>

          {error && (
            <Alert type="error" className="mb-5">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User ID */}
            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                User ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  id="login-user-id"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alice, bob"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-line rounded-lg text-sm text-ink placeholder-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                Password / Passphrase
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-line rounded-lg text-sm text-ink placeholder-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all"
                />
              </div>
            </div>

            {/* Quick Demo Presets */}
            <div className="pt-1">
              <span className="text-[11px] text-body block mb-1.5">Quick Demo Presets:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  id="preset-alice"
                  onClick={() => setUsername("alice")}
                  className={`text-xs px-3 py-1.5 rounded-pill border transition-all font-medium ${
                    username === "alice"
                      ? "bg-purple-100 text-purple-700 border-purple-300"
                      : "bg-panel text-body border-line hover:border-muted hover:text-ink"
                  }`}
                >
                  alice (Sender)
                </button>
                <button
                  type="button"
                  id="preset-bob"
                  onClick={() => setUsername("bob")}
                  className={`text-xs px-3 py-1.5 rounded-pill border transition-all font-medium ${
                    username === "bob"
                      ? "bg-purple-100 text-purple-700 border-purple-300"
                      : "bg-panel text-body border-line hover:border-muted hover:text-ink"
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
              className="w-full py-3 mt-2"
            >
              Sign In to SecureCorp
            </Button>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-5 border-t border-line text-center text-xs text-muted flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Client-Side End-to-End Cryptography Architecture</span>
          </div>
        </div>
      </div>
    </div>
  );
};
