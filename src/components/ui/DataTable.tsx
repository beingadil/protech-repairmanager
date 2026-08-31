import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { SkeletonTable } from './Skeleton';

/**
 * Column definition for DataTable.
 * `align: right` is intended for money/number columns (tabular figures).
 */
export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => React.Key;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  /** Pagination */
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  /** Sticky first column for wide tables (token / voucher no). */
  footer?: React.ReactNode;
}

const alignCls = (a?: 'left' | 'right' | 'center') =>
  a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyIcon,
  emptyAction,
  onRowClick,
  page,
  pageSize,
  totalRows,
  onPageChange,
  footer
}: DataTableProps<T>): React.ReactElement {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const from = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalRows, page * pageSize);

  return (
    <div className="table-container">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="table-header">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`py-3 px-4 ${alignCls(c.align)} ${c.className ?? ''}`}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <div className="py-8 px-6 space-y-4" role="status" aria-label="Loading">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-4 animate-pulse rounded bg-slate-200/70 dark:bg-slate-800/70" />
                    ))}
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`transition-colors ${onRowClick ? 'table-row' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors'}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`py-3 px-4 ${alignCls(c.align)} ${c.className ?? ''}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {footer && rows.length > 0 && !isLoading && (
            <tfoot>
              <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                {footer}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination footer */}
      {totalRows > pageSize && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing <strong className="text-slate-700 dark:text-slate-200">{from}</strong>–
            <strong className="text-slate-700 dark:text-slate-200">{to}</strong> of{' '}
            <strong className="text-slate-700 dark:text-slate-200">{totalRows}</strong>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="btn-ghost p-1.5"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn-ghost p-1.5"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Loading variant used by callers before data arrives (mirrors table shape). */
export function DataTableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return <SkeletonTable rows={rows} cols={cols} />;
}

export default DataTable;
