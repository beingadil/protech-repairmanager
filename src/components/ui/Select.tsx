import React from 'react';
import FieldShell from './FieldShell';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'> {
  options: SelectOption[];
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Styled native select. Use DropdownSelect for rich menus (search,
 * custom entry); this wrapper is kept for compact filter rows where a
 * full popover would overflow.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, label, hint, error, required = false, fullWidth = true, placeholder, className = '', ...props }, ref) => {
    return (
      <FieldShell
        id={props.id}
        label={label}
        hint={hint}
        error={error}
        required={required}
        fullWidth={fullWidth}
        className={className}
      >
        {(aria) => (
          <div className="relative">
            <select
              {...props}
              {...aria}
              ref={ref}
              required={required}
              className={`w-full appearance-none pl-3.5 pr-9 py-2.5 text-sm bg-white dark:bg-slate-900 border rounded-xl text-slate-900 dark:text-slate-100 outline-none transition-all cursor-pointer min-w-0 ${
                props.value === '' || props.value == null
                  ? 'text-slate-400 dark:text-slate-500'
                  : ''
              } ${
                error
                  ? 'border-rose-400 dark:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                  : 'border-slate-300/80 dark:border-slate-700/80 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:ring-blue-400/20 dark:focus:border-blue-400'
              }`}
            >
              {placeholder && (
                <option value="" disabled>
                  {placeholder}
                </option>
              )}
              {options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </FieldShell>
    );
  }
);

Select.displayName = 'Select';

export default Select;
