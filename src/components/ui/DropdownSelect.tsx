import React from 'react';
import FieldShell from './FieldShell';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownSelectProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show a search box at the top of the menu (recommended for 8+ options). */
  searchable?: boolean;
  /**
   * Adds an "Other…" item that reveals an inline text field so the user can
   * enter a custom value that is not in the list. Nothing gets blocked.
   */
  allowCustom?: boolean;
  otherLabel?: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  id?: string;
  disabled?: boolean;
  className?: string;
}

const OTHER = '__other__';

/**
 * Custom styled dropdown menu: trigger shaped like `.input-field`, popover
 * panel with keyboard navigation, optional search and an "Other…" escape
 * hatch for values outside the preset list.
 */
export const DropdownSelect: React.FC<DropdownSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchable = false,
  allowCustom = false,
  otherLabel = 'Other…',
  label,
  hint,
  error,
  required = false,
  size = 'md',
  align = 'left',
  id,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [customMode, setCustomMode] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = React.useState(-1);

  // If the current value is not one of the presets (e.g. loaded legacy data),
  // surface it as a first-class option so the control never shows a blank.
  const extraOption =
    value && !options.some((o) => o.value === value) ? { value, label: value } : null;
  const allOptions: DropdownOption[] = extraOption ? [extraOption, ...options] : options;

  React.useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setCustomMode(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (customMode) {
      customInputRef.current?.focus();
    } else if (searchable) {
      searchRef.current?.focus();
    }
  }, [open, customMode, searchable]);

  const customInputRef = React.useRef<HTMLInputElement>(null);
  const [customDraft, setCustomDraft] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, allOptions]);

  const selectValue = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
    setCustomMode(false);
  };

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    const isCustomValue = !!value && !options.some((o) => o.value === value);
    setCustomMode(allowCustom && isCustomValue);
    setCustomDraft(isCustomValue ? value : '');
    setHighlighted(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if ((e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') && !disabled) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (customMode || e.target === searchRef.current) {
      if (e.key === 'Escape') {
        setOpen(false);
        setCustomMode(false);
      }
      return;
    }
    const itemIdx = filtered.findIndex((o) => !o.disabled);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlighted >= 0 && filtered[highlighted] && !filtered[highlighted].disabled) {
          selectValue(filtered[highlighted].value);
        } else if (itemIdx >= 0) {
          selectValue(filtered[itemIdx].value);
        }
        break;
      case 'Escape':
        setOpen(false);
        break;
    }
  };

  const selected = allOptions.find((o) => o.value === value);

  const triggerClasses = `w-full inline-flex items-center justify-between gap-2 text-left border rounded-xl outline-none transition-all cursor-pointer min-w-0 ${
    size === 'sm'
      ? 'px-3 py-1.5 text-xs rounded-lg'
      : 'px-3.5 py-2.5 text-sm'
  } ${
    error
      ? 'border-rose-400 dark:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
      : 'border-slate-300/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:ring-blue-400/20 dark:focus:border-blue-400'
  } ${disabled ? 'opacity-50 pointer-events-none' : ''}`;

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className={`relative min-w-0 ${className}`}>
      <FieldShell
        label={label}
        hint={hint}
        error={error}
        required={required}
        fullWidth={false}
        className="block"
      >
        {(aria) =>
          !open ? (
            <button
              type="button"
              {...aria}
              disabled={disabled}
              onClick={openMenu}
              aria-haspopup="listbox"
              aria-expanded={false}
              className={triggerClasses}
            >
              <span
                className={`truncate ${
                  selected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {selected ? selected.label : placeholder}
              </span>
              <svg
                className="w-4 h-4 shrink-0 text-slate-400 transition-transform"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <div
              {...aria}
              role="listbox"
              tabIndex={-1}
              className={`${triggerClasses} ring-2 ring-blue-500/20 border-blue-500 dark:border-blue-400`}
            >
              <span className="truncate text-slate-900 dark:text-slate-100">
                {selected ? selected.label : placeholder}
              </span>
            </div>
          )
        }
      </FieldShell>

      {open && (
        <div
          className={`absolute z-40 mt-1 w-full min-w-[10rem] max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-1 scrollbar-thin ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {searchable && !customMode && (
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(-1);
              }}
              placeholder="Search…"
              className="w-full mb-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 dark:focus:border-blue-400 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          )}

          {customMode ? (
            <div className="p-1 space-y-2">
              <input
                ref={customInputRef}
                type="text"
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = customDraft.trim();
                    if (v) selectValue(v);
                  }
                  if (e.key === 'Escape') {
                    setOpen(false);
                    setCustomMode(false);
                  }
                }}
                placeholder="Type a custom value"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:border-blue-500 dark:focus:border-blue-400 text-slate-900 dark:text-slate-100"
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setCustomMode(false)}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Back to list
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const v = customDraft.trim();
                    if (v) selectValue(v);
                  }}
                  disabled={!customDraft.trim()}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50 cursor-pointer disabled:pointer-events-none"
                >
                  Use this value
                </button>
              </div>
            </div>
          ) : (
            <>
              {allowCustom && (
                <button
                  type="button"
                  onClick={() => setCustomMode(true)}
                  role="option"
                  aria-selected={!!value && !options.some((o) => o.value === value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors text-blue-600 dark:text-blue-400 font-medium ${
                    !value || !options.some((o) => o.value === value)
                      ? ''
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {otherLabel}
                  {!value && (
                    <span className="ml-auto text-[10px] font-normal text-slate-400">type manually</span>
                  )}
                </button>
              )}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                  No matches{allowCustom ? ' — pick Other… to enter a value' : ''}
                </p>
              )}
              <div ref={listRef}>
                {filtered.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onMouseEnter={() => setHighlighted(idx)}
                      onClick={() => !opt.disabled && selectValue(opt.value)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg transition-colors ${
                        opt.disabled
                          ? 'opacity-40 cursor-not-allowed'
                          : 'cursor-pointer'
                      } ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium'
                          : highlighted === idx
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                            : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="truncate flex-1">{opt.label}</span>
                      {isSelected && (
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

DropdownSelect.displayName = 'DropdownSelect';

export default DropdownSelect;
