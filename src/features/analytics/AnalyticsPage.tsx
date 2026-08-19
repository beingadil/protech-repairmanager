import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp,
  DollarSign,
  Laptop,
  Monitor,
  Wrench,
  Calendar,
  CheckCircle2,
  PieChart as PieChartIcon,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import { query } from '../../lib/db';
import { formatCurrency } from '../../lib/utils';

interface MonthlyRevenueData {
  month: string;
  revenue: number;
}

interface SymptomData {
  name: string;
  count: number;
}

export const AnalyticsPage: React.FC = () => {
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);
  const [avgTicket, setAvgTicket] = useState(0);
  const [laptopCount, setLaptopCount] = useState(0);
  const [pcCount, setPcCount] = useState(0);
  const [topSymptoms, setTopSymptoms] = useState<SymptomData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenueData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
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
          AVG(CASE WHEN charges > 0 THEN charges ELSE NULL END) as avg_charge,
          SUM(CASE WHEN job_type = 'laptop' AND deleted_at IS NULL THEN 1 ELSE 0 END) as laptop_jobs,
          SUM(CASE WHEN job_type = 'pc' AND deleted_at IS NULL THEN 1 ELSE 0 END) as pc_jobs
        FROM jobs WHERE deleted_at IS NULL
      `);

      if (sumRes.length > 0) {
        setTotalRevenue(sumRes[0].total_revenue || 0);
        setTotalJobs(sumRes[0].total_jobs || 0);
        setAvgTicket(Math.round(sumRes[0].avg_charge || 0));
        setLaptopCount(sumRes[0].laptop_jobs || 0);
        setPcCount(sumRes[0].pc_jobs || 0);
      }

      // 2. Real symptoms aggregation from jobs
      const symptomsRes = await query<{ symptoms: string }>(`
        SELECT symptoms FROM jobs WHERE symptoms IS NOT NULL AND TRIM(symptoms) != '' AND deleted_at IS NULL
      `);

      const symptomMap: { [key: string]: number } = {};
      for (const row of symptomsRes) {
        if (!row.symptoms) continue;
        // Clean and categorize symptoms
        const raw = row.symptoms.trim();
        const parts = raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          const capitalized = p.charAt(0).toUpperCase() + p.slice(1);
          symptomMap[capitalized] = (symptomMap[capitalized] || 0) + 1;
        }
      }

      const sortedSymptoms = Object.entries(symptomMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      setTopSymptoms(sortedSymptoms);

      // 3. Real monthly revenue aggregation (last 6 months)
      const monthsList: MonthlyRevenueData[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthName = d.toLocaleDateString('en-US', { month: 'short' });

        try {
          const mJobRes = await query<{ m_rev: number }>(`
            SELECT SUM(charges) as m_rev 
            FROM jobs 
            WHERE payment_status = 'paid' 
              AND receive_date LIKE ? 
              AND deleted_at IS NULL
          `, [`${yearMonth}%`]);

          const mFinRes = await query<{ f_rev: number }>(`
            SELECT SUM(amount) as f_rev 
            FROM financial_transactions 
            WHERE type = 'credit' 
              AND date LIKE ?
          `, [`${yearMonth}%`]);

          const jobRev = mJobRes[0]?.m_rev || 0;
          const finRev = mFinRes[0]?.f_rev || 0;
          const rev = Math.max(jobRev, finRev);

          monthsList.push({
            month: monthName,
            revenue: rev
          });
        } catch (e) {
          monthsList.push({ month: monthName, revenue: 0 });
        }
      }

      setMonthlyData(monthsList);
    } catch (e) {
      console.error('Failed to load analytics:', e);
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-heading">Analytics & Financial Reports</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Real-time business intelligence, revenue metrics, and hardware fault trends</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gross Earnings</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-heading">{formatCurrency(totalRevenue)}</p>
          <span className="text-xs text-slate-400 dark:text-slate-500">Collected repair charges</span>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Repairs</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-heading">{totalJobs}</p>
          <span className="text-xs text-slate-400 dark:text-slate-500">Recorded intake devices</span>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Average Ticket Charge</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2 font-heading">{formatCurrency(avgTicket)}</p>
          <span className="text-xs text-slate-400 dark:text-slate-500">Average price per repair</span>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Device Type Breakdown</span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2 font-heading">
            {laptopCount} : {pcCount}
          </p>
          <span className="text-xs text-slate-400 dark:text-slate-500">{laptopCount} Laptops • {pcCount} Desktops</span>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Monthly Revenue History</h3>
            <span className="text-xs text-slate-400 font-mono">Past 6 Months</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                  formatter={(val: any) => [`${formatCurrency(val)}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Symptoms List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 font-heading">
            Common Hardware Faults
          </h3>
          {topSymptoms.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No fault patterns recorded yet. As you add repair jobs, common issues will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topSymptoms.map((sym, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{sym.name}</span>
                  <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg font-bold">
                    {sym.count} {sym.count === 1 ? 'case' : 'cases'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
