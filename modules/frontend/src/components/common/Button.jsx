import React from "react";
import { Loader2 } from "lucide-react";

const variants = {
  primary:
    "bg-purple-600 hover:bg-purple-700 text-white shadow-purple border border-purple-600 hover:border-purple-700",
  secondary:
    "bg-panel hover:bg-line text-ink border border-line",
  outline:
    "bg-white hover:bg-purple-50 text-purple-600 border border-purple-300 hover:border-purple-400",
  danger:
    "bg-white hover:bg-red-50 text-red-600 border border-red-300 hover:border-red-400",
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
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-pill text-sm font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px ${base} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
    </button>
  );
};
