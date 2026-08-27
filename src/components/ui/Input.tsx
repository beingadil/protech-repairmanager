import React from 'react';
import FieldShell from './FieldShell';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const inputBase =
  'w-full text-sm bg-white dark:bg-slate-900 border rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all min-w-0';

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-3.5 py-2.5 rounded-xl',
} as const;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, required = false, fullWidth = true, size = 'md', className = '', ...props }, ref) => {
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
          <input
            {...props}
            {...aria}
            ref={ref}
            required={required}
            className={`${inputBase} ${sizeClasses[size]} ${
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

Input.displayName = 'Input';

export default Input;
