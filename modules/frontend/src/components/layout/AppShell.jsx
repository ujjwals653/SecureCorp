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
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isMockMode } from "../../services/portalApi";
import { Badge } from "../common/Badge";

export const AppShell = ({ children }) => {
  const { userId, role, ticket, expiresAt, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-navy-950 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-navy-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-slate-100 tracking-wider">SECURECORP</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-navy-900 border-r border-slate-800 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col justify-between p-4">
          <div>
            {/* Branding */}
            <div className="flex items-center gap-3 px-2 py-4 mb-6 border-b border-slate-800">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-slate-100 text-lg tracking-wider">SECURECORP</h1>
                <p className="text-[10px] uppercase font-mono text-cyan-400 tracking-widest">
                  Zero-Trust Cryptographic Core
                </p>
              </div>
            </div>

            {/* Nav Links */}
            <nav className="space-y-1.5">
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
                          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-md shadow-blue-500/10"
                          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
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

          {/* System Architecture Callout */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-mono">
                <Lock className="w-3.5 h-3.5 text-amber-400" /> Client Crypto Architecture
              </span>
              <Badge variant="amber" className="text-[10px] px-1.5 py-0 font-mono">
                Crypto Core Pending
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Designed for in-browser encryption. Crypto Core runtime integration pending.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-navy-900/60 border-b border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Badge variant="blue" icon={Cpu} className="font-mono text-xs">
              {isMockMode() ? "DEVELOPMENT (MOCK API)" : "PRODUCTION BACKEND"}
            </Badge>
            <span className="text-xs text-slate-500 font-mono">|</span>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Ticket: <span className="text-slate-300 font-semibold">{ticket ? ticket.substring(0, 14) + "..." : "N/A"}</span>
            </span>
          </div>

          {/* User badge & Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <div className="p-1 rounded-md bg-blue-500/20 text-blue-400">
                <User className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-semibold text-slate-200 capitalize">
                  {userId || "User"}
                </span>
                <span className="block text-[10px] text-cyan-400 font-mono uppercase">
                  {role || "Employee"}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all"
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
