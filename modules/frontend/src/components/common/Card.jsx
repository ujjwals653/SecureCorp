import React from "react";

export const Card = ({ children, title, subtitle, icon: Icon, action, className = "" }) => {
  return (
    <div
      className={`bg-white border border-line rounded-xl p-6 shadow-sm animate-fade-up ${className}`}
    >
      {(title || Icon || action) && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 rounded-lg bg-purple-100 text-purple-600 border border-purple-200">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div>
              {title && <h3 className="text-base font-semibold text-ink">{title}</h3>}
              {subtitle && <p className="text-xs text-body mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
