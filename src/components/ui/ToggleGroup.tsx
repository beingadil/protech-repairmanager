import React from 'react';

export interface ToggleOption {
  value: string;
  label: string;
  /** Secondary line shown under the label in 'cards' variant. */
  sublabel?: string;
  icon?: React.ReactNode;
  /** Accent used when selected in 'cards' variant. */
  tone?: 'neutral' | 'success' | 'danger' | 'info' | 'warning' | 'violet';
  disabled?: boolean;
}

interface ToggleGroupProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  /** Segmented = compact pill bar; cards = large tappable tiles. */
  variant?: 'segmented' | 'cards';
  columns?: number;
  className?: string;
}

const toneClasses: Record<NonNullable<ToggleOption['tone']>, string> = {
  neutral:
    'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800/60 ring-1 ring-slate-900/10 dark:ring-slate-100/10',
  success:
    'border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/20',
  danger:
    'border-rose-500 dark:border-rose-400 bg-rose-50 dark:bg-rose-950/30 ring-1 ring-rose-500/20',
  info: 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500/20',
  warning:
    'border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-500/20',
  violet:
    'border-violet-500 dark:border-violet-400 bg-violet-50 dark:bg-violet-950/30 ring-1 ring-violet-500/20',
};

const toneText: Record<NonNullable<ToggleOption['tone']>, string> = {
  neutral: 'text-slate-900 dark:text-white',
  success: 'text-emerald-700 dark:text-emerald-400',
  danger: 'text-rose-700 dark:text-rose-400',
  info: 'text-blue-700 dark:text-blue-400',
  warning: 'text-amber-700 dark:text-amber-400',
  violet: 'text-violet-700 dark:text-violet-400',
};

/**
 * Segmented control / selectable cards that replace the hand-rolled
 * status toggle buttons scattered across job, customer and payment forms.
 * Labels never overflow awkwardly — card subtitles wrap by design.
 */
export const ToggleGroup: React.FC<ToggleGroupProps> = ({
  options,
  value,
  onChange,
  variant = 'segmented',
  columns = 2,
  className = '',
}) => {
  if (variant === 'segmented') {
    return (
      <div
        role="radiogroup"
        className={`flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl ${className}`}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && onChange(opt.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none min-w-0 ${
                active
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {opt.icon && <span className="shrink-0 inline-flex">{opt.icon}</span>}
              <span className="truncate">{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      className={`grid gap-2.5 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const tone = opt.tone ?? 'neutral';
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={`flex items-start gap-2.5 border rounded-xl px-3.5 py-3 text-left transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none min-w-0 ${
              active
                ? `${toneClasses[tone]}`
                : 'border-slate-300/80 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
            }`}
          >
            {(opt.icon || active) && (
              <span
                className={`shrink-0 mt-0.5 inline-flex ${
                  active ? toneText[tone] : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {active ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  opt.icon
                )}
              </span>
            )}
            <span className="min-w-0">
              <span
                className={`block text-xs font-semibold leading-snug ${
                  active ? toneText[tone] : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {opt.label}
              </span>
              {opt.sublabel && (
                <span className="block text-[11px] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">
                  {opt.sublabel}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};

ToggleGroup.displayName = 'ToggleGroup';

export default ToggleGroup;
