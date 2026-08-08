import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Bell, CheckCircle2, Phone, Send } from 'lucide-react';
import { query } from '../../lib/db';
import { formatDateTime } from '../../lib/utils';

interface NotificationLog {
  id: number;
  job_id: number;
  token_number?: string;
  customer_name?: string;
  channel: string;
  message: string;
  sent_at: string;
  status: string;
}

export const NotificationsPage: React.FC = () => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res = await query<NotificationLog>(`
        SELECT n.*, j.token_number, c.name as customer_name
        FROM job_notifications n
        JOIN jobs j ON n.job_id = j.id
        JOIN customers c ON j.customer_id = c.id
        ORDER BY n.id DESC LIMIT 30
      `);
      setLogs(res);
    } catch (e) {
      console.error('Failed to load notifications log:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-heading">Customer Notifications Log</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">History of all WhatsApp and SMS messages dispatched to customers</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400">Loading notification log...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No messages sent yet. Use "Notify WhatsApp" on any repair job detail page.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 border border-slate-200/80 dark:border-slate-800/80 rounded-xl flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded uppercase text-[10px]">
                      {log.channel}
                    </span>
                    <span>{log.customer_name}</span>
                    <span className="text-slate-400 font-normal">({log.token_number})</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50 whitespace-pre-wrap">
                    {log.message}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{formatDateTime(log.sent_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

