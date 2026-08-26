import React from 'react';

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
  const groupId = name.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className={`field-label ${required ? 'field-required' : ''}`}>
          {label}
        </label>
      )}
      <div
        role="radiogroup"
        aria-labelledby={label ? `${groupId}-label` : undefined}
        aria-describedby={hint ? `${groupId}-hint` : error ? `${groupId}-error` : undefined}
        className={direction === 'horizontal' ? 'flex flex-wrap gap-4' : 'space-y-2'}
      >
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`inline-flex items-center gap-2 cursor-pointer ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange?.(opt.value)}
              disabled={opt.disabled}
              required={required}
              className="radio"
            />
            <span className="text-sm text-text-primary">{opt.label}</span>
          </label>
        ))}
      </div>
      {hint && !error && (
        <p id={`${groupId}-hint`} className="field-hint">{hint}</p>
      )}
      {error && (
        <p id={`${groupId}-error`} className="field-error" role="alert">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 10-2 0v6a1 1 0 102 0V5z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

export default RadioGroup;