import React from 'react';

interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label: string;
  hint?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({
  label,
  hint,
  checked = false,
  onChange,
  className = '',
  id,
  disabled,
  ...props
}) => {
  const toggleId = id || label?.toLowerCase().replace(/\s+/g, '-') || React.useId();

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div className="flex-1 min-w-0">
        <label htmlFor={toggleId} className="text-sm font-medium text-text-primary cursor-pointer">
          {label}
        </label>
        {hint && (
          <p className="field-hint text-sm mt-0.5">{hint}</p>
        )}
      </div>
      <label htmlFor={toggleId} className="switch shrink-0 cursor-pointer" aria-label={label}>
        <input
          type="checkbox"
          id={toggleId}
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          {...props}
        />
        <span className="thumb" aria-hidden="true" />
      </label>
    </div>
  );
};

export default Toggle;