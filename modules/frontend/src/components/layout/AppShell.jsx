import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Shield,
  LayoutDashboard,
  Key,
  Share2,
  Inbox,
  LogOut,
  User,
  Menu,
  X,
  Lock,
  Cpu,
  Clock,
  Ticket,
  Copy,
  Check,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isMockMode } from "../../services/portalApi";
import { Badge } from "../common/Badge";

export const AppShell = ({ children }) => {
  const { userId, role, ticket, issuedAt, expiresAt, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState(false);

  const handleCopyTicket = (e) => {
    e.stopPropagation();
    if (ticket) {
      navigator.clipboard.writeText(ticket);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2000);
    }
  };

  const isExpired = expiresAt ? new Date(expiresAt) <= new Date() : false;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { label: "Key Setup", path: "/keys", icon: Key },
    { label: "Share File", path: "/share", icon: Share2 },
    { label: "Inbox", path: "/inbox", icon: Inbox },
  ];

  return (
    <div className="min-h-screen bg-panel flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-line">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600">
            <Shield className="w-5 h-5" />
          </div>
          <span className="font-bold text-ink tracking-wider text-base">SECURECORP</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-body hover:text-ink rounded-lg hover:bg-panel transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-line transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static shadow-sm ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col justify-between p-4">
          <div>
            {/* Branding */}
            <div className="flex items-center gap-3 px-2 py-4 mb-5 border-b border-line">
              <div className="p-2 rounded-xl bg-purple-100 text-purple-600 border border-purple-200">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-ink text-base tracking-wider leading-tight">SECURECORP</h1>
                <p className="text-[10px] uppercase text-body tracking-widest leading-tight mt-0.5">
                  Zero-Trust Cryptographic Core
                </p>
              </div>
            </div>

            {/* Nav Links */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-purple-100 text-purple-700 border border-purple-200"
                          : "text-body hover:bg-panel hover:text-ink"
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Architecture Callout */}
          <div className="p-3.5 rounded-xl bg-panel border border-line space-y-2">
            <div className="flex items-center gap-1.5 text-xs">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-body font-medium">Client Crypto Architecture</span>
            </div>
            <Badge variant="amber" className="text-[10px] px-2 py-0 font-medium">
              Crypto Core Pending
            </Badge>
            <p className="text-[11px] text-body leading-tight">
              Designed for in-browser encryption. Crypto Core runtime integration pending.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 bg-white border-b border-line">
          <div className="flex items-center gap-3">
            <Badge variant="purple" icon={Cpu} className="font-medium text-xs">
              {isMockMode() ? "DEVELOPMENT (MOCK API)" : "PRODUCTION BACKEND"}
            </Badge>
            <span className="text-muted text-xs">|</span>

            {/* Ticket hover tooltip */}
            <div className="relative group inline-flex items-center">
              <span className="text-xs text-body flex items-center gap-1.5 cursor-pointer py-1 px-1.5 rounded hover:bg-panel transition-colors">
                <Clock className="w-3.5 h-3.5 text-muted group-hover:text-purple-500 transition-colors" />
                <span>Ticket:</span>
                <span className="text-ink font-semibold underline decoration-dotted decoration-muted underline-offset-4 group-hover:text-purple-600 group-hover:decoration-purple-400">
                  {ticket ? ticket.substring(0, 14) + "..." : "N/A"}
                </span>
              </span>

              {ticket && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 p-4 bg-white border border-line rounded-xl shadow-lg z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 transform origin-top -translate-y-1 group-hover:translate-y-0">
                  {/* Arrow */}
                  <div className="absolute -top-1.5 left-7 w-3 h-3 bg-white border-t border-l border-line rotate-45" />

                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-line">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-purple-500" />
                      <span className="text-xs font-semibold text-ink tracking-wide">Auth Ticket Details</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-pill border font-medium ${
                        isExpired
                          ? "bg-red-50 text-red-600 border-red-200"
                          : "bg-emerald-50 text-emerald-600 border-emerald-200"
                      }`}
                    >
                      {isExpired ? "● Expired" : "● Active / Valid"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2 rounded-lg bg-panel border border-line">
                      <span className="block text-[10px] text-muted font-medium">Identity</span>
                      <span className="font-semibold text-ink">{userId || "N/A"}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-panel border border-line">
                      <span className="block text-[10px] text-muted font-medium">Role</span>
                      <span className="font-semibold text-purple-700 uppercase text-[11px]">
                        {role || "employee"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-panel border border-line">
                      <span className="block text-[10px] text-muted font-medium">Issued At</span>
                      <span className="text-body text-[11px]">
                        {issuedAt ? new Date(issuedAt).toLocaleTimeString() : "Session Start"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-panel border border-line">
                      <span className="block text-[10px] text-muted font-medium">Expires At</span>
                      <span className="text-body text-[11px]">
                        {expiresAt ? new Date(expiresAt).toLocaleTimeString() : "Session Active"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-line">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-[10px] uppercase text-muted font-medium">Token String</span>
                      <button
                        type="button"
                        onClick={handleCopyTicket}
                        className="flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 transition-colors"
                      >
                        {copiedTicket ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Token</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2 rounded-lg bg-panel border border-line text-[10px] text-body break-all select-all max-h-20 overflow-y-auto leading-relaxed">
                      {ticket}
                    </div>
                  </div>

                  <div className="mt-2 text-[9px] text-muted flex items-center justify-between">
                    <span>§7.2 Kerberos-Style Ticket</span>
                    <span>HMAC-SHA256 Signed</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User chip & Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel border border-line">
              <div className="p-1 rounded-md bg-purple-100 text-purple-600">
                <User className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-semibold text-ink capitalize">{userId || "User"}</span>
                <span className="block text-[10px] text-purple-600 uppercase">{role || "Employee"}</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-body hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
