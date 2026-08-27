import React from 'react';

interface FieldShellProps {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: (ariaProps: {
    'id': string;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
  }) => React.ReactNode;
}

/** Shared label/hint/error chrome for form controls. */
export function FieldShell({
  id,
  label,
  hint,
  error,
  required = false,
  fullWidth = true,
  className = '',
  children,
}: FieldShellProps) {
  const autoId = React.useId();
  const fieldId = id || autoId;

  return (
    <div className={`${fullWidth ? 'w-full min-w-0' : ''} ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="form-label">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      {children({
        'id': fieldId,
        'aria-invalid': error ? true : false,
        'aria-describedby': error
          ? `${fieldId}-error`
          : hint
            ? `${fieldId}-hint`
            : undefined,
      })}
      {hint && !error && (
        <p id={`${fieldId}-hint`} className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 10-2 0v6a1 1 0 102 0V5z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

export default FieldShell;
