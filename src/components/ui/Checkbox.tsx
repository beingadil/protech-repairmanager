import React from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      hint,
      error,
      required = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s+/g, '-') || React.useId();

    return (
      <div className={`flex items-start gap-3 ${className}`}>
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className={`checkbox mt-0.5 ${error ? 'border-danger' : ''}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${checkboxId}-error` : hint ? `${checkboxId}-hint` : undefined}
          required={required}
          {...props}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor={checkboxId} className="text-sm text-text-primary cursor-pointer">
            {label}
          </label>
          {hint && !error && (
            <p id={`${checkboxId}-hint`} className="field-hint text-sm">{hint}</p>
          )}
          {error && (
            <p id={`${checkboxId}-error`} className="field-error" role="alert">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 10-2 0v6a1 1 0 102 0V5z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;