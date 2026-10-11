import React from "react";

const variantStyles = {
  blue:    "bg-blue-50 text-blue-700 border-blue-200",
  cyan:    "bg-cyan-50 text-cyan-700 border-cyan-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber:   "bg-amber-50 text-amber-700 border-amber-200",
  red:     "bg-red-50 text-red-700 border-red-200",
  slate:   "bg-panel text-body border-line",
  purple:  "bg-purple-100 text-purple-700 border-purple-200",
  green:   "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const Badge = ({ children, variant = "slate", className = "", icon: Icon }) => {
  const styles = variantStyles[variant] || variantStyles.slate;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-semibold border ${styles} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
};
