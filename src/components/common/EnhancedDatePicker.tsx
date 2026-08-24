import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Preset {
  label: string;
  offsetDays: number;
}

interface EnhancedDatePickerProps {
  label: string;
  value: string; // Format: YYYY-MM-DD
  onChange: (val: string) => void;
  required?: boolean;
  minDate?: string;
  helperText?: string;
  presets?: Preset[];
  type?: 'receive' | 'return';
  baseDate?: string; // e.g. receiveDate to compute offsets from
}

// Helpers
const formatDateToISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseISODate = (str: string): Date => {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const formatDisplayDate = (str: string): string => {
  if (!str) return 'Select Date';
  const date = parseISODate(str);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const getRelativeLabel = (targetStr: string, baseStr?: string): string | null => {
  if (!targetStr) return null;
  const todayISO = formatDateToISO(new Date());
  
  if (targetStr === todayISO) return 'Today';
  
  const target = parseISODate(targetStr).getTime();
  const today = parseISODate(todayISO).getTime();
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays <= 14) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -14) return `${Math.abs(diffDays)} days ago`;

  return null;
};

export const EnhancedDatePicker: React.FC<EnhancedDatePickerProps> = ({
  label,
  value,
  onChange,
  required = false,
  minDate,
  helperText,
  presets,
  type = 'receive',
  baseDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Month state for calendar view
  const selectedDate = value ? parseISODate(value) : new Date();
  const [viewDate, setViewDate] = useState<Date>(selectedDate);

  useEffect(() => {
    if (value) {
      setViewDate(parseISODate(value));
    }
  }, [value]);

  // Click outside to close calendar popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Default preset pills
  const defaultPresets: Preset[] = presets || (type === 'receive'
    ? [
        { label: 'Today', offsetDays: 0 },
        { label: 'Yesterday', offsetDays: -1 }
      ]
    : [
        { label: 'Today', offsetDays: 0 },
        { label: 'Tomorrow', offsetDays: 1 },
        { label: '+2 Days', offsetDays: 2 },
        { label: '+3 Days', offsetDays: 3 },
        { label: '+5 Days', offsetDays: 5 },
        { label: '+1 Wk', offsetDays: 7 }
      ]);

  const handleApplyOffset = (offsetDays: number) => {
    const anchor = baseDate ? parseISODate(baseDate) : new Date();
    const result = new Date(anchor);
    result.setDate(result.getDate() + offsetDays);
    const iso = formatDateToISO(result);
    onChange(iso);
    setIsOpen(false);
  };

  // Calendar calculations
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const relativeTag = getRelativeLabel(value);

  return (
    <div className="relative space-y-1.5" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="form-label">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {relativeTag && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {relativeTag}
          </span>
        )}
      </div>

      {/* Main Trigger Field */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`input-field flex items-center justify-between cursor-pointer group font-sans text-left transition-all duration-200 ${
            isOpen
              ? 'border-slate-600 dark:border-slate-500 ring-2 ring-slate-600/20 dark:ring-slate-500/30 shadow-xs'
              : 'hover:border-slate-400 dark:hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate text-xs">
              {formatDisplayDate(value)}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500 hidden sm:inline px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-md">
              {value}
            </span>
            <div className={`p-1 rounded-lg transition-colors ${isOpen ? 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
              <CalendarIcon className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            </div>
          </div>
        </button>

        {/* Fallback Native Input for Form Validation/Accessibility */}
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          min={minDate}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      {/* Quick Preset Pills */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        {defaultPresets.map((p) => {
          const anchor = baseDate ? parseISODate(baseDate) : new Date();
          const target = new Date(anchor);
          target.setDate(target.getDate() + p.offsetDays);
          const targetISO = formatDateToISO(target);
          const isSelected = value === targetISO;

          return (
            <button
              key={p.label}
              type="button"
              onClick={() => handleApplyOffset(p.offsetDays)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-600 text-white border-slate-600 shadow-2xs scale-105'
                  : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {helperText && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{helperText}</p>
      )}

      {/* Popover Calendar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ type: 'spring', damping: 26, stiffness: 380 }}
            className="absolute left-1/2 -translate-x-1/2 z-50 mt-2 w-64 p-3 bg-white/95 dark:bg-slate-900/95  border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-xl dark:shadow-2xl space-y-2.5 ring-1 ring-slate-900/5 dark:ring-white/10"
          >
            {/* Header: Month / Year Controls */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="text-xs font-bold text-slate-900 dark:text-white font-heading tracking-tight">
                {monthNames[month]} {year}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Day Names Header */}
            <div className="grid grid-cols-7 text-center text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
              {/* Previous Month Padding */}
              {Array.from({ length: firstDayOfMonth }).map((_, idx) => {
                const dayNum = daysInPrevMonth - firstDayOfMonth + idx + 1;
                return (
                  <span key={`prev-${idx}`} className="py-1 text-[11px] text-slate-300 dark:text-slate-700 select-none">
                    {dayNum}
                  </span>
                );
              })}

              {/* Current Month Days */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dateObj = new Date(year, month, dayNum);
                const iso = formatDateToISO(dateObj);
                const isSelected = value === iso;
                const isToday = formatDateToISO(new Date()) === iso;
                const isDisabled = minDate ? iso < minDate : false;

                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      onChange(iso);
                      setIsOpen(false);
                    }}
                    className={`py-1 text-[11px] rounded-lg font-semibold transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-slate-600 text-white shadow-2xs font-bold scale-105'
                        : isToday
                        ? 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-bold'
                        : isDisabled
                        ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
              <button
                type="button"
                onClick={() => {
                  const todayISO = formatDateToISO(new Date());
                  onChange(todayISO);
                  setIsOpen(false);
                }}
                className="text-slate-600 dark:text-slate-300 font-bold hover:underline cursor-pointer"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
