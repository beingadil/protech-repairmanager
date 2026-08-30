import React from 'react';
import { Banknote, Clock, Gift } from 'lucide-react';
import { PaymentStatus } from '../../types/job';
import { formatCurrency } from '../../lib/utils';

/**
 * Single source of truth for how a repair job's payment status is presented.
 * Keeps the repair timeline and the payment status card in sync, and derives
 * everything from the actual job `payment_status` value (data-driven).
 *
 * Existing payment statuses (see src/types/job.ts):
 *   - 'complimentary' — payment waived, NO cashbook / financial transaction
 *   - 'paid'          — payment received in full
 *   - 'due'           — payment outstanding (nothing received yet)
 */
export interface PaymentStatusMeta {
  /** Short uppercased label shown on the status card, e.g. COMPLIMENTARY */
  badgeLabel: string;
  /** Timeline step title, e.g. Complimentary Payment */
  statusLabel: string;
  /** Secondary description, e.g. No payment required */
  description: string;
  /** Optional extra line for partial payments, e.g. "Rs 1,500 received of Rs 3,000 net" */
  subLine?: string;
  Icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
  /** Filled node styling for the lifecycle timeline */
  nodeCls: string;
  /** Card border + background for the prominent payment status card */
  cardCls: string;
  /** Icon tile styling for the prominent payment status card */
  iconBoxCls: string;
  titleCls: string;
  descCls: string;
}

export interface PaymentBalance {
  /** Total actually received in credits for this job (>= 0). */
  paid: number;
  /** Charges minus discount minus paid; >= 0. */
  remaining: number;
}

/**
 * Derives the visible payment presentation for a repair job.
 *
 * Existing payment statuses (see src/types/job.ts):
 *   - 'complimentary' — payment waived, NO cashbook / financial transaction
 *   - 'paid'          — payment received in full
 *   - 'due'           — payment outstanding (nothing OR part received)
 *
 * When `balance` is supplied and the job is 'due' with money received but a
 * remainder left, the status renders as PARTIAL: a Rs 3,000 bill with Rs 1,500
 * received shows "Rs 1,500 remaining" and only flips to PAID once the rest
 * is paid. Overpaid jobs clamp to PAID (remaining floors at 0).
 */
export function getPaymentStatusMeta(status: PaymentStatus, charges = 0, balance?: PaymentBalance): PaymentStatusMeta {
  if (status === 'due' && balance && balance.paid > 0 && balance.remaining > 0) {
    return {
      badgeLabel: 'PARTIAL',
      statusLabel: 'Partially Paid',
      description: `${formatCurrency(balance.remaining)} remaining`,
      subLine: `${formatCurrency(balance.paid)} received of ${formatCurrency(balance.paid + balance.remaining)} net`,
      Icon: Banknote,
      completed: false,
      nodeCls: 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700/60 ring-4 ring-amber-500/10',
      cardCls: 'border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30',
      iconBoxCls: 'bg-amber-500 text-white',
      titleCls: 'text-amber-700 dark:text-amber-300',
      descCls: 'text-amber-600 dark:text-amber-400'
    };
  }

  switch (status) {
    case 'complimentary':
      return {
        badgeLabel: 'COMPLIMENTARY',
        statusLabel: 'Complimentary Payment',
        description: 'No payment required',
        Icon: Gift,
        completed: true,
        nodeCls: 'bg-violet-600 text-white border-violet-600 ring-4 ring-violet-500/15',
        cardCls:
          'border-violet-300 dark:border-violet-800/60 bg-violet-50 dark:bg-violet-950/30',
        iconBoxCls: 'bg-violet-600 text-white',
        titleCls: 'text-violet-700 dark:text-violet-300',
        descCls: 'text-violet-600 dark:text-violet-400',
      };
    case 'paid':
      return {
        badgeLabel: 'PAID',
        statusLabel: 'Payment Received',
        description: charges ? `${formatCurrency(charges)} received` : 'Payment received',
        Icon: Banknote,
        completed: true,
        nodeCls: 'bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-500/10',
        cardCls:
          'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30',
        iconBoxCls: 'bg-emerald-600 text-white',
        titleCls: 'text-emerald-700 dark:text-emerald-300',
        descCls: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'due':
    default:
      return {
        badgeLabel: 'DUE',
        statusLabel: 'Payment Pending',
        description: 'Payment required',
        Icon: Clock,
        completed: false,
        nodeCls:
          'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-700/60 ring-4 ring-rose-500/10',
        cardCls: 'border-rose-300 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30',
        iconBoxCls: 'bg-rose-600 text-white',
        titleCls: 'text-rose-700 dark:text-rose-300',
        descCls: 'text-rose-600 dark:text-rose-400',
      };
  }
}

interface PaymentStatusCardProps {
  status: PaymentStatus;
  charges?: number;
  /** Optional paid/remaining breakdown; enables the PARTIAL presentation. */
  balance?: PaymentBalance;
}

/**
 * Prominent Payment Status card for the Repair Job Details status bar.
 * Communicates the state clearly, e.g.:
 *   ✓ COMPLIMENTARY
 *     No payment required
 *   ⏳ PARTIAL
 *     Rs 1,500 remaining · Rs 1,500 received of Rs 3,000 net
 */
export const PaymentStatusCard: React.FC<PaymentStatusCardProps> = ({ status, charges = 0, balance }) => {
  const meta = getPaymentStatusMeta(status, charges, balance);
  const Icon = meta.Icon;
  const isDone = meta.completed;

  return (
    <div className="flex flex-col min-w-[210px]">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
        Payment Status
      </span>
      <div className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 shadow-xs ${meta.cardCls}`}>
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${meta.iconBoxCls}`}
        >
          {isDone ? <Icon className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-black uppercase tracking-wide leading-tight ${meta.titleCls}`}>
            {meta.badgeLabel}
          </p>
          <p className={`text-[11px] font-semibold leading-tight mt-0.5 ${meta.descCls}`}>
            {meta.description}
          </p>
          {meta.subLine && (
            <p className="text-[10px] font-medium leading-tight mt-0.5 text-slate-500 dark:text-slate-400">
              {meta.subLine}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusCard;