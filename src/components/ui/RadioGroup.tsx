import React from 'react';
import FieldShell from './FieldShell';

interface RadioOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface RadioGroupProps {
  name: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  label,
  hint,
  error,
  required = false,
  options,
  value,
  onChange,
  direction = 'vertical',
  className = '',
}) => {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} fullWidth={false} className={className}>
      {(aria) => (
        <div
          role="radiogroup"
          aria-label={label}
          aria-describedby={aria['aria-describedby']}
          className={direction === 'horizontal' ? 'flex flex-wrap gap-4' : 'space-y-2'}
        >
          {options.map((opt) => (
            <label
              key={opt.value}
              className={`inline-flex items-start gap-2 cursor-pointer ${
                opt.disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange?.(opt.value)}
                disabled={opt.disabled}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-slate-900 dark:accent-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
                {opt.label}
                {opt.hint && (
                  <span className="block text-[11px] text-slate-400 dark:text-slate-500">{opt.hint}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </FieldShell>
  );
};

RadioGroup.displayName = 'RadioGroup';

export default RadioGroup;
