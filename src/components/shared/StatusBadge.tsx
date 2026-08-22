import React from 'react';
import { CheckCircle2, Clock, AlertCircle, PackageCheck, PackageX, Wrench, Search, Package } from 'lucide-react';
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

  // deliver — 5-stage workflow
  const deliverConfig: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    pending: {
      icon: <PackageX className="w-3.5 h-3.5" />,
      label: 'PENDING',
      cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25'
    },
    in_progress: {
      icon: <Wrench className="w-3.5 h-3.5" />,
      label: 'IN PROGRESS',
      cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
    },
    in_diagnostics: {
      icon: <Search className="w-3.5 h-3.5" />,
      label: 'DIAGNOSTICS',
      cls: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30'
    },
    ready: {
      icon: <Package className="w-3.5 h-3.5" />,
      label: 'READY',
      cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
    },
    delivered: {
      icon: <PackageCheck className="w-3.5 h-3.5" />,
      label: 'DELIVERED',
      cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    }
  };
  const cfg = deliverConfig[String(status)] || deliverConfig.pending;
  return (
    <span className={`inline-flex items-center rounded-full border ${sizeClasses} ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
};
