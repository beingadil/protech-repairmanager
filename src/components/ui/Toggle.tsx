import React from 'react';

interface ToggleProps {
  label: string;
  hint?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  label,
  hint,
  checked = false,
  onChange,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div className="flex-1 min-w-0">
        <span
          onClick={() => !disabled && onChange?.(!checked)}
          className="block text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none"
        >
          {label}
        </span>
        {hint && (
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50 disabled:pointer-events-none ${
          checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
};

Toggle.displayName = 'Toggle';

export default Toggle;
