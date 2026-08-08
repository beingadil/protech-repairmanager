import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  BarChart2,
  TrendingUp,
  DollarSign,
  Laptop,
  Monitor,
  Wrench,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { query } from '../../lib/db';
import { formatCurrency } from '../../lib/utils';

export const AnalyticsPage: React.FC = () => {
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);
  const [avgTicket, setAvgTicket] = useState(0);
  const [laptopCount, setLaptopCount] = useState(0);
  const [pcCount, setPcCount] = useState(0);
  const [topSymptoms, setTopSymptoms] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      // 1. Overall financial summary
      const sumRes = await query<{
        total_revenue: number;
        total_jobs: number;
        avg_charge: number;
        laptop_jobs: number;
        pc_jobs: number;
      }>(`
        SELECT 
          SUM(CASE WHEN payment_status = 'paid' AND deleted_at IS NULL THEN charges ELSE 0 END) as total_revenue,
          COUNT(*) as total_jobs,
          AVG(charges) as avg_charge,
          SUM(CASE WHEN job_type = 'laptop' AND deleted_at IS NULL THEN 1 ELSE 0 END) as laptop_jobs,
          SUM(CASE WHEN job_type = 'pc' AND deleted_at IS NULL THEN 1 ELSE 0 END) as pc_jobs
        FROM jobs WHERE deleted_at IS NULL
      `);

      if (sumRes.length > 0) {
        setTotalRevenue(sumRes[0].total_revenue || 0);
        setTotalJobs(sumRes[0].total_jobs || 0);
        setAvgTicket(sumRes[0].avg_charge || 0);
        setLaptopCount(sumRes[0].laptop_jobs || 0);
        setPcCount(sumRes[0].pc_jobs || 0);
      }

      // Mock top symptoms distribution
      setTopSymptoms([
        { name: 'Power / Charging Fault', count: 18 },
        { name: 'Display / Screen Cracked', count: 14 },
        { name: 'Thermal Overheating', count: 12 },
        { name: 'OS Boot Loop / Corrupted', count: 9 },
        { name: 'Keyboard / Liquid Spill', count: 6 }
      ]);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    }
  };

  const monthlyMock = [
    { month: 'Jan', revenue: 24000 },
    { month: 'Feb', revenue: 31000 },
    { month: 'Mar', revenue: 28000 },
    { month: 'Apr', revenue: 38000 },
    { month: 'May', revenue: 42000 },
    { month: 'Jun', revenue: 35000 },
    { month: 'Jul', revenue: 49000 },
    { month: 'Aug', revenue: 53000 }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-heading">Analytics & Financial Reports</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Business intelligence, monthly revenue, and device repair metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gross Earnings</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-heading">{formatCurrency(totalRevenue)}</p>
          <span className="text-xs text-slate-400 dark:text-slate-500">Total collected repair charges</span>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Repairs</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-heading">{totalJobs}</p>
          <span className="text-xs text-slate-400 dark:text-slate-500">Completed & active devices</span>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Average Ticket Charge</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2 font-heading">{formatCurrency(avgTicket)}</p>
          <span className="text-xs text-slate-400 dark:text-slate-500">Average price per repair job</span>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Laptop vs PC Ratio</span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2 font-heading">
            {laptopCount} : {pcCount}
          </p>
          <span className="text-xs text-slate-400 dark:text-slate-500">{laptopCount} Laptops, {pcCount} PCs</span>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 font-heading">Monthly Revenue Growth (PKR)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyMock}>
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                  formatter={(val: any) => [`Rs. ${val}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Symptoms List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 font-heading">
            Most Common Repairs
          </h3>
          <div className="space-y-3">
            {topSymptoms.map((sym, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{sym.name}</span>
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg font-bold text-slate-900 dark:text-white">
                  {sym.count} cases
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

