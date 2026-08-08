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

interface JobProgressTrackerProps {
  job: Job;
  onToggleDelivery?: () => void;
  onOpenNotify?: () => void;
}

export const JobProgressTracker: React.FC<JobProgressTrackerProps> = ({
  job,
  onToggleDelivery,
  onOpenNotify
}) => {
  const isDelivered = job.deliver_status === 'delivered';
  const overdue = isOverdue(job.return_date, job.deliver_status);

  // Determine current active step: 1 = Received, 2 = In Repair, 3 = Ready, 4 = Delivered
  // If delivered -> Step 4
  // If pending & overdue -> Step 3 (Attention needed)
  // Default pending -> Step 2 or 3
  const currentStep: number = isDelivered ? 4 : overdue ? 3 : 2;

  const steps = [
    {
      id: 1,
      title: 'Intake Received',
      subtitle: formatDate(job.receive_date),
      icon: ClipboardCheck,
      completed: true,
      current: currentStep === 1
    },
    {
      id: 2,
      title: 'In Diagnostic Repair',
      subtitle: 'Bench testing & service',
      icon: Wrench,
      completed: currentStep > 2,
      current: currentStep === 2
    },
    {
      id: 3,
      title: overdue ? 'Overdue Return' : 'Ready for Pickup',
      subtitle: `Target: ${formatDate(job.return_date)}`,
      icon: overdue ? AlertTriangle : PackageCheck,
      completed: currentStep > 3,
      current: currentStep === 3,
      isOverdue: overdue
    },
    {
      id: 4,
      title: 'Handed to Customer',
      subtitle: isDelivered ? 'Delivered & Closed' : 'Pending Customer Pickup',
      icon: UserCheck,
      completed: isDelivered,
      current: currentStep === 4
    }
  ];

  const progressPercentage = isDelivered ? 100 : overdue ? 75 : 50;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
              Repair Progress Lifecycle
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Live tracking from intake to customer delivery
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
            isDelivered
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : overdue
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
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
      <div className="relative pt-2 pb-1">
        {/* Track Line Background */}
        <div className="absolute top-7 left-6 right-6 h-1 bg-slate-100 dark:bg-slate-800 rounded-full -z-0" />

        {/* Active Animated Progress Line */}
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className={`absolute top-7 left-6 h-1 rounded-full -z-0 ${
            isDelivered
              ? 'bg-emerald-500'
              : overdue
              ? 'bg-amber-500'
              : 'bg-blue-600'
          }`}
          style={{ maxWidth: 'calc(100% - 3rem)' }}
        />

        {/* Steps Grid */}
        <div className="grid grid-cols-4 gap-2 relative z-10">
          {steps.map((step) => {
            const Icon = step.icon;
            const isDone = step.completed;
            const isCurrent = step.current;

            return (
              <div key={step.id} className="flex flex-col items-center text-center group">
                {/* Step Circle Node */}
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs transition-all duration-200 border shadow-xs ${
                    isDone
                      ? 'bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-500/10'
                      : isCurrent
                      ? step.isOverdue
                        ? 'bg-amber-500 text-white border-amber-500 ring-4 ring-amber-500/20 animate-pulse'
                        : 'bg-blue-600 text-white border-blue-600 ring-4 ring-blue-600/20'
                      : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </motion.div>

                {/* Step Labels */}
                <div className="mt-2.5 space-y-0.5">
                  <p className={`text-xs font-bold leading-tight ${
                    isDone || isCurrent
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    {step.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
