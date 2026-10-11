import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

const alertStyles = {
  info: {
    bg: "bg-blue-950/40 border-blue-800/60 text-blue-200",
    icon: Info,
    iconColor: "text-blue-400",
  },
  warning: {
    bg: "bg-amber-950/40 border-amber-800/60 text-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
  },
  error: {
    bg: "bg-red-950/40 border-red-800/60 text-red-200",
    icon: AlertCircle,
    iconColor: "text-red-400",
  },
  success: {
    bg: "bg-emerald-950/40 border-emerald-800/60 text-emerald-200",
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
  },
};

export const Alert = ({ type = "info", title, children, className = "" }) => {
  const config = alertStyles[type] || alertStyles.info;
  const IconComponent = config.icon;

  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${config.bg} ${className}`}>
      <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
      <div className="text-sm">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        <div className="text-slate-300 leading-relaxed">{children}</div>
      </div>
    </div>
  );
};
