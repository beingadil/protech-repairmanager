import React, { useState, useEffect } from 'react';
import { Search, User, Phone, MapPin, Wrench, DollarSign, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { query } from '../../lib/db';
import { Customer } from '../../types/customer';
import { formatCurrency } from '../../lib/utils';
import { exportCustomersToCSV } from '../../lib/export-utils';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await query<Customer>(`
        SELECT 
          c.*,
          COUNT(j.id) as total_jobs,
          SUM(CASE WHEN j.payment_status = 'paid' AND j.deleted_at IS NULL THEN j.charges ELSE 0 END) as total_spent
        FROM customers c
        LEFT JOIN jobs j ON c.id = j.customer_id AND j.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY total_jobs DESC
      `);
      setCustomers(res);
    } catch (e) {
      console.error('Failed to load customer directory:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.mobile || '').includes(search) ||
      (c.address || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-heading">Customer Directory</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">List of all registered customers with repair history and expenditure logs</p>
        </div>

        <button
          onClick={() => exportCustomersToCSV(filtered)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export Customer CSV</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-4 shadow-xs">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers by name, phone, or location..."
            className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
        </div>
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading customers...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">No customer records found.</div>
        ) : (
          filtered.map((c, idx) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(idx * 0.04, 0.3) }}
              whileHover={{ y: -2 }}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-3 hover:border-blue-500 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white font-heading">{c.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" /> {c.mobile || 'No Phone'}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-800/40">
                  {c.total_jobs || 0} Repairs
                </span>
              </div>

              {c.address && (
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {c.address}
                </p>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Spent:</span>
                <span className="font-black text-slate-900 dark:text-white font-heading">{formatCurrency(c.total_spent || 0)}</span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

