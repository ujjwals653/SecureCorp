import React from "react";

export const Card = ({ children, title, subtitle, icon: Icon, action, className = "" }) => {
  return (
    <div
      className={`bg-navy-900/90 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-sm ${className}`}
    >
      {(title || Icon || action) && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div>
              {title && <h3 className="text-base font-semibold text-slate-100">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
