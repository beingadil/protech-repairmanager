import React from 'react';
import { motion } from 'motion/react';
import {
  ClipboardCheck,
  Wrench,
  PackageCheck,
  UserCheck,
  Check,
  AlertTriangle,
  Clock,
  Send
} from 'lucide-react';
import { Job } from '../../types/job';
import { formatDate, isOverdue } from '../../lib/utils';
import { getPaymentStatusMeta, PaymentBalance } from './paymentStatus';

interface JobProgressTrackerProps {
  job: Job;
  onToggleDelivery?: () => void;
  onOpenNotify?: () => void;
  /** Paid/remaining breakdown; when supplied, a part-paid job renders as PARTIAL. */
  paymentBalance?: PaymentBalance;
}

interface TimelineStep {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
  current: boolean;
  isOverdue?: boolean;
  /** Payment stage is the 5th & final lifecycle node */
  isPayment?: boolean;
  /** Filled node styling used only for the payment stage */
  paymentNodeCls?: string;
}

export const JobProgressTracker: React.FC<JobProgressTrackerProps> = ({
  job,
  onToggleDelivery,
  onOpenNotify,
  paymentBalance
}) => {
  const isDelivered = job.deliver_status === 'delivered';
  const overdue = isOverdue(job.return_date, job.deliver_status);

  // Derive the timeline state from the ACTUAL deliver_status value so that
  // quick status changes from the job list (or edit page) are reflected here.
  // Lifecycle: pending → in_progress → in_diagnostics → ready → delivered
  const status = job.deliver_status;
  const atBench = status === 'in_progress' || status === 'in_diagnostics';
  const isReady = status === 'ready';

  // Step 1 is always completed once the job exists; 'pending' means the job is
  // received but work has not started yet, so Intake is the current stage.
  // Step 2 covers the bench phase (in_progress / in_diagnostics).
  // Step 3 is the active stage only when status === 'ready' (or overdue attention).
  // Step 4 completes on delivery.

  const steps: TimelineStep[] = [
    {
      id: 1,
      title: 'Intake Received',
      subtitle: formatDate(job.receive_date),
      icon: ClipboardCheck,
      completed: true,
      current: status === 'pending'
    },
    {
      id: 2,
      title: 'In Diagnostic Repair',
      subtitle: 'Bench testing & service',
      icon: Wrench,
      completed: isReady || isDelivered,
      current: atBench
    },
    {
      id: 3,
      title: overdue && !isReady && !isDelivered ? 'Overdue Return' : 'Ready for Pickup',
      subtitle: `Target: ${formatDate(job.return_date)}`,
      icon: overdue && !isReady && !isDelivered ? AlertTriangle : PackageCheck,
      completed: isDelivered,
      current: isReady || (overdue && !atBench),
      isOverdue: overdue
    },
    {
      id: 4,
      title: 'Handed to Customer',
      subtitle: isDelivered ? 'Delivered & Closed' : 'Pending Customer Pickup',
      icon: UserCheck,
      completed: isDelivered,
      current: isDelivered
    }
  ];

  // Payment stage is data-driven from the actual job payment status.
  // It ALWAYS appears as the 5th (final) timeline stage — only its state changes.
  // Existing statuses: 'complimentary' | 'paid' | 'due'
  const paymentMeta = getPaymentStatusMeta(job.payment_status, job.charges, paymentBalance);
  const paymentCompleted = paymentMeta.completed;

  steps.push({
    id: 5,
    title: paymentMeta.statusLabel,
    subtitle: paymentMeta.description,
    icon: paymentMeta.Icon,
    completed: paymentCompleted,
    current: !paymentCompleted,
    isPayment: true,
    paymentNodeCls: paymentMeta.nodeCls
  });

  // Percentage reflects how many of the 5 lifecycle stages have been reached.
  const progressPercentage = Math.round((steps.filter((s) => s.completed).length / steps.length) * 100);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
              Repair Progress Lifecycle
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Live tracking from intake to final payment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
            isDelivered
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : overdue
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}>
            {progressPercentage}% Completed
          </span>

          {onToggleDelivery && (
            <button
              onClick={onToggleDelivery}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                isDelivered
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-2xs'
              }`}
            >
              {isDelivered ? 'Mark Undelivered' : 'Mark Delivered ✓'}
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Line */}
      <div className="pt-2 pb-1">
        {/* Wraps the 5-stage timeline so narrow screens scroll instead of clipping */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="relative pt-2 min-w-[540px] sm:min-w-0">
            {/* Track Line Background */}
            <div className="absolute top-7 left-6 right-6 h-1 bg-slate-100 dark:bg-slate-800 rounded-full -z-0" />

            {/* Active Animated Progress Line */}
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className={`absolute top-7 left-6 h-1 rounded-full -z-0 ${
                isDelivered || paymentCompleted
                  ? 'bg-emerald-500'
                  : overdue
                  ? 'bg-amber-500'
                  : 'bg-slate-600'
              }`}
              style={{ maxWidth: 'calc(100% - 3rem)' }}
            />

            {/* Steps Grid — 5 fixed stages, payment is always last */}
            <div className="grid grid-cols-5 gap-2 relative z-10">
              {steps.map((step) => {
                const Icon = step.icon;
                const isDone = step.completed;
                const isCurrent = step.current;
                const isPayment = step.isPayment === true;

                // The final payment node is larger so it carries the same weight
                // as the other lifecycle nodes and reads clearly as the last stage.
                const nodeSize = isPayment ? 'w-12 h-12' : 'w-10 h-10';
                const iconSize = isPayment ? 'w-6 h-6' : 'w-4 h-4';

                const nodeCls = isPayment
                  ? isDone
                    ? step.paymentNodeCls
                    : 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-700/60 ring-4 ring-rose-500/10'
                  : isDone
                  ? 'bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-500/10'
                  : isCurrent
                  ? step.isOverdue
                    ? 'bg-amber-500 text-white border-amber-500 ring-4 ring-amber-500/20 animate-pulse'
                    : 'bg-slate-600 text-white border-slate-600 ring-4 ring-slate-600/20'
                  : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800';

                return (
                  <div key={step.id} className="flex flex-col items-center text-center group">
                    {/* Step Circle Node */}
                    <motion.div
                      whileHover={{ scale: 1.08 }}
                      className={`${nodeSize} rounded-2xl flex items-center justify-center font-bold text-xs transition-all duration-200 border shadow-xs ${nodeCls}`}
                    >
                      {isDone ? (
                        <Check className={`${isPayment ? 'w-6 h-6' : 'w-5 h-5'} stroke-[2.5]`} />
                      ) : (
                        <Icon className={iconSize} />
                      )}
                    </motion.div>

                    {/* Step Labels */}
                    <div className="mt-2.5 space-y-0.5">
                      <p className={`text-xs leading-tight ${
                        isPayment ? 'font-black' : 'font-bold'
                      } ${
                        isDone || isCurrent
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {step.title}
                      </p>
                      <p className={`text-[10px] font-mono leading-tight ${
                        isPayment
                          ? job.payment_status === 'complimentary'
                            ? 'text-violet-500 dark:text-violet-400 font-semibold'
                            : isDone
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-rose-500 dark:text-rose-400 font-semibold'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {step.subtitle}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
