import React from 'react';

/**
 * Standard KPI stat card. Replaces the four copy-pasted KPI div-chains that
 * every page re-implemented with slightly different classes.
 */
type KpiTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: KpiTone;
  onClick?: () => void;
}

const toneAccent: Record<KpiTone, string> = {
  neutral: 'border-l-slate-400 dark:border-l-slate-600',
  success: 'border-l-emerald-500',
  danger: 'border-l-rose-500',
  warning: 'border-l-amber-500',
  info: 'border-l-blue-500'
};

const toneIconBox: Record<KpiTone, string> = {
  neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  success: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
  danger: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',
  warning: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
  info: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  sub,
  icon,
  tone = 'neutral',
  onClick
}) => {
  const clickable = typeof onClick === 'function';
  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`card-container p-4 flex items-center justify-between gap-3 border-l-4 ${toneAccent[tone]} ${
        clickable ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="kpi-label">{label}</p>
        <h3 className="text-xl font-black text-slate-900 dark:text-white font-heading mt-1 truncate">
          {value}
        </h3>
        {sub && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{sub}</p>}
      </div>
      {icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneIconBox[tone]}`}>
          {icon}
        </div>
      )}
    </div>
  );
};

export default KpiCard;
