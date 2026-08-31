import React from 'react';

/**
 * Standard page header: title, subtitle, and right-aligned action slot.
 * Replaces the hand-rolled per-page headers (each with slightly different
 * spacing/classes) across all feature pages.
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional icon tile shown before the title. */
  icon?: React.ReactNode;
  /** Right-aligned action area (buttons, filters). */
  actions?: React.ReactNode;
  /** Optional breadcrumb-ish back control rendered before the title. */
  back?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon, actions, back }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div className="flex items-center gap-3 min-w-0">
      {back}
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h1 className="page-title truncate" title={title}>
          {title}
        </h1>
        {subtitle && <p className="page-subtitle mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
  </div>
);

export default PageHeader;
