import React from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, hint, error, required = false, className = '', ...props }, ref) => {
    const id = props.id || React.useId();

    return (
      <div className={className}>
        <div className="flex items-start gap-2.5">
          <input
            {...props}
            ref={ref}
            type="checkbox"
            id={id}
            required={required}
            aria-invalid={error ? true : false}
            aria-describedby={
              error ? `${id}-error` : hint ? `${id}-hint` : undefined
            }
            className="mt-0.5 h-4 w-4 shrink-0 rounded cursor-pointer accent-slate-900 dark:accent-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          />
          <label
            htmlFor={id}
            className="text-sm text-slate-700 dark:text-slate-300 leading-snug cursor-pointer select-none"
          >
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        </div>
        {hint && !error && (
          <p id={`${id}-hint`} className="ml-[26px] mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${id}-error`} role="alert" className="ml-[26px] mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
