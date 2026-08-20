import React from 'react';
import { CheckCircle2, Clock, AlertCircle, PackageCheck, PackageX } from 'lucide-react';
import { PaymentStatus, DeliverStatus } from '../../types/job';

interface StatusBadgeProps {
  type: 'payment' | 'deliver' | 'overdue';
  status?: PaymentStatus | DeliverStatus | string;
  isOverdue?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  status,
  isOverdue = false,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5 font-medium',
    lg: 'px-3 py-1.5 text-sm gap-2 font-semibold'
  }[size];

  if (isOverdue || type === 'overdue') {
    return (
      <span className={`inline-flex items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 ${sizeClasses}`}>
        <AlertCircle className="w-3.5 h-3.5" />
        Overdue Return
      </span>
    );
  }

  if (type === 'payment') {
    const isPaid = status === 'paid';
    return (
      <span
        className={`inline-flex items-center rounded-full border ${sizeClasses} ${
          isPaid
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
        }`}
      >
        {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
        {isPaid ? 'PAID' : 'DUE'}
      </span>
    );
  }

  // deliver
  const isDelivered = status === 'delivered';
  return (
    <span
      className={`inline-flex items-center rounded-full border ${sizeClasses} ${
        isDelivered
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25'
      }`}
    >
      {isDelivered ? <PackageCheck className="w-3.5 h-3.5" /> : <PackageX className="w-3.5 h-3.5" />}
      {isDelivered ? 'DELIVERED' : 'PENDING'}
    </span>
  );
};
