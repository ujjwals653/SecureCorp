import React from "react";

const variants = {
  primary:
    "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20 border border-blue-400/30",
  secondary:
    "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
  outline:
    "bg-transparent hover:bg-slate-800/60 text-slate-300 border border-slate-700 hover:border-slate-600",
  danger:
    "bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40",
};

export const Button = ({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  loading = false,
  icon: Icon,
  className = "",
}) => {
  const base = variants[variant] || variants.primary;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-cyan-600 ${base} ${className}`}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
    </button>
  );
};
