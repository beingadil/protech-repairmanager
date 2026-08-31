import React from 'react';

/**
 * Unified empty state with optional icon, message and call-to-action.
 * Replaces the inconsistent "No records found" table cells.
 */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => (
  <div className={`flex flex-col items-center justify-center py-14 px-6 text-center ${className}`}>
    {icon && (
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
        {icon}
      </div>
    )}
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</p>
    {description && (
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
