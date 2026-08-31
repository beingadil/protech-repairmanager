import React from 'react';

/**
 * Skeleton loading primitives — replaces the "Loading database..." text
 * placeholders. Shimmer bars match card/table/KPI layouts.
 */

export const SkeletonBar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800/80 ${className}`}
    aria-hidden="true"
  />
);

/** Full-page-ish skeleton block for a list of cards/rows. */
export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className="space-y-3" role="status" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="card-container flex items-center gap-4 py-4">
        <SkeletonBar className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBar className="h-3.5 w-1/3" />
          <SkeletonBar className="h-3 w-1/5" />
        </div>
        <SkeletonBar className="h-3.5 w-20 shrink-0" />
      </div>
    ))}
  </div>
);

/** Skeleton for a table with a header and N body rows. */
export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 8, cols = 6 }) => (
  <div className="table-container" role="status" aria-label="Loading">
    <div className="grid gap-4 p-4 border-b border-slate-200 dark:border-slate-800"
         style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonBar key={i} className="h-3 w-full" />
      ))}
    </div>
    <div className="p-4 space-y-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBar key={c} className="h-3.5 w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/** KPI card skeleton row (4 cards by default). */
export const SkeletonKpis: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="status" aria-label="Loading">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card-container space-y-3">
        <SkeletonBar className="h-2.5 w-24" />
        <SkeletonBar className="h-6 w-32" />
        <SkeletonBar className="h-2.5 w-20" />
      </div>
    ))}
  </div>
);
