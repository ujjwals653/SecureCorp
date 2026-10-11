import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

const alertStyles = {
  info: {
    wrap: "bg-blue-50 border-blue-200 text-blue-800",
    icon: Info,
    iconColor: "text-blue-500",
  },
  warning: {
    wrap: "bg-amber-50 border-amber-200 text-amber-800",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
  },
  error: {
    wrap: "bg-red-50 border-red-200 text-red-800",
    icon: AlertCircle,
    iconColor: "text-red-500",
  },
  success: {
    wrap: "bg-emerald-50 border-emerald-200 text-emerald-800",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
  },
};

export const Alert = ({ type = "info", title, children, className = "" }) => {
  const config = alertStyles[type] || alertStyles.info;
  const IconComponent = config.icon;

  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${config.wrap} ${className}`}>
      <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
      <div className="text-sm leading-relaxed">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
};
