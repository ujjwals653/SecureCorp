import React from "react";

const variantStyles = {
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  red: "bg-red-500/10 text-red-400 border-red-500/30",
  slate: "bg-slate-700/50 text-slate-300 border-slate-600/50",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

export const Badge = ({ children, variant = "slate", className = "", icon: Icon }) => {
  const styles = variantStyles[variant] || variantStyles.slate;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
};
