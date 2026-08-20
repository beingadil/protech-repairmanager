import React, { useState, useEffect } from 'react';
import { Search, Wrench, User, Tag, Calendar, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useUIStore } from '../../store/ui';
import { query } from '../../lib/db';
import { Job } from '../../types/job';
import { StatusBadge } from './StatusBadge';
import { TokenDisplay } from './TokenDisplay';

export const CommandPalette: React.FC = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Job[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (search.trim().length > 0) {
      query<Job>(
        `SELECT j.*, c.name as customer_name, c.mobile as customer_mobile 
         FROM jobs j 
         JOIN customers c ON j.customer_id = c.id 
         WHERE j.deleted_at IS NULL AND (
           j.token_number LIKE ? OR 
           c.name LIKE ? OR 
           c.mobile LIKE ? OR 
           j.serial_no LIKE ? OR 
           j.model LIKE ?
         )
         ORDER BY j.id DESC LIMIT 8`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
      ).then(setResults);
    } else {
      setResults([]);
    }
  }, [search]);

  return (
    <AnimatePresence>
      {isCommandPaletteOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setCommandPaletteOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            {/* Header Search Input */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by token (TK-1001), customer, phone, model, or serial..."
                className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none text-base"
              />
              <button
                onClick={() => setCommandPaletteOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-96 overflow-y-auto p-2">
              {search.trim().length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Type anything to search repair jobs across the entire system</p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">TK-1001</span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">Dell XPS</span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">Ahmad</span>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-sm">No repair records found for "{search}"</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((job) => (
                    <motion.button
                      key={job.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => {
                        setCommandPaletteOpen(false);
                        navigate(`/jobs/${job.id}`);
                      }}
                      className="w-full p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center justify-between text-left transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <TokenDisplay token={job.token_number} size="sm" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                            {job.model || `${job.job_type.toUpperCase()} Device`}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" /> {job.customer_name}
                            </span>
                            <span>•</span>
                            <span>{job.customer_mobile}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusBadge type="payment" status={job.payment_status} size="sm" />
                        <StatusBadge type="deliver" status={job.deliver_status} size="sm" />
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors ml-1" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Search ProData Repair Database</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px]">ESC</kbd> to close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

