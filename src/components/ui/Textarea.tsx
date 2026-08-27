import React from 'react';
import FieldShell from './FieldShell';

interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, required = false, fullWidth = true, rows = 4, className = '', ...props }, ref) => {
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
          <textarea
            {...props}
            {...aria}
            ref={ref}
            rows={rows}
            required={required}
            className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all resize-y min-w-0 ${
              error
                ? 'border-rose-400 dark:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                : 'border-slate-300/80 dark:border-slate-700/80 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:ring-blue-400/20 dark:focus:border-blue-400'
            }`}
          />
        )}
      </FieldShell>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
