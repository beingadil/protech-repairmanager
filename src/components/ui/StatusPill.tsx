import React from 'react';

/**
 * Compact status pill used in tables and cards. One consistent shape for
 * PAID/DUE/PARTIAL/receipt/payment/invoice statuses — replaces the dozens of
 * hand-inlined pill spans across pages.
 */
type PillTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'violet';

interface StatusPillProps {
  children: React.ReactNode;
  tone?: PillTone;
  icon?: React.ReactNode;
  className?: string;
}

const toneClasses: Record<PillTone, string> = {
  neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  success: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
  danger: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60',
  warning: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
  info: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
  violet: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/60'
};

export const StatusPill: React.FC<StatusPillProps> = ({ children, tone = 'neutral', icon, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide border whitespace-nowrap ${toneClasses[tone]} ${className}`}
  >
    {icon}
    {children}
  </span>
);

/** Map a voucher type to its pill tone. */
export const voucherTone = (type: string): PillTone =>
  type === 'receipt' ? 'success' : type === 'payment' ? 'danger' : 'info';

/** Map an invoice status to its pill tone. */
export const invoiceStatusTone = (status: string): PillTone => {
  switch (status) {
    case 'paid':
      return 'success';
    case 'partial':
      return 'warning';
    case 'cancelled':
      return 'neutral';
    case 'draft':
      return 'info';
    default:
      return 'danger'; // issued / unpaid
  }
};

export default StatusPill;
