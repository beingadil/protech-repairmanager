import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';

/**
 * Standard filter bar: instant search slot + arbitrary filter controls +
 * an automatic reset action shown when any filter is active. Pages compose
 * their DropdownSelect filter dropdowns as children.
 */
interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  /** True when any filter differs from its default — shows the Reset button. */
  isFiltered: boolean;
  onReset: () => void;
  children?: React.ReactNode;
  /** Optional summary line below the bar (result counts etc). */
  summary?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  isFiltered,
  onReset,
  children,
  summary
}) => (
  <div className="card-container p-4 space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div className="lg:col-span-2 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="input-field pl-9 pr-8"
          aria-label={searchPlaceholder}
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {children}
    </div>
    {(summary || isFiltered) && (
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
        {summary ? <span>{summary}</span> : <span />}
        {isFiltered && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:underline font-semibold"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Filters
          </button>
        )}
      </div>
    )}
  </div>
);

export default FilterBar;
