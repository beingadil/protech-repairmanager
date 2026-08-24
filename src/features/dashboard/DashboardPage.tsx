import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Wrench,
  PackageCheck,
  DollarSign,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Laptop,
  CheckCircle2,
  Calendar,
  Boxes
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { query } from '../../lib/db';
import { Job } from '../../types/job';
import { DashboardStats } from '../../types/settings';
import { formatCurrency, formatDate } from '../../lib/utils';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { TokenDisplay } from '../../components/shared/TokenDisplay';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    total_jobs: 0,
    active_jobs: 0,
    delivered_jobs: 0,
    revenue_total: 0,
    today_jobs: 0,
    overdue_jobs_count: 0
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [overdueJobs, setOverdueJobs] = useState<Job[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState({
    total_parts: 0,
    low_stock: 0,
    out_of_stock: 0,
    total_val: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // 1. Calculate overall stats
      const statsRes = await query<{
        total_jobs: number;
        active_jobs: number;
        delivered_jobs: number;
        revenue_total: number;
        today_jobs: number;
      }>(`
        SELECT 
          COUNT(*) as total_jobs,
          SUM(CASE WHEN deliver_status = 'pending' AND deleted_at IS NULL THEN 1 ELSE 0 END) as active_jobs,
          SUM(CASE WHEN deliver_status = 'delivered' AND deleted_at IS NULL THEN 1 ELSE 0 END) as delivered_jobs,
          SUM(CASE WHEN payment_status = 'paid' AND deleted_at IS NULL THEN charges ELSE 0 END) as revenue_total,
          SUM(CASE WHEN DATE(receive_date) = DATE('now') AND deleted_at IS NULL THEN 1 ELSE 0 END) as today_jobs
        FROM jobs WHERE deleted_at IS NULL
      `);

      // 2. Fetch Overdue Jobs (return_date < today AND deliver_status = 'pending')
      const todayStr = new Date().toISOString().split('T')[0];
      const overdueRes = await query<Job>(`
        SELECT j.*, c.name as customer_name, c.mobile as customer_mobile
        FROM jobs j
        JOIN customers c ON j.customer_id = c.id
        WHERE j.deleted_at IS NULL 
          AND j.deliver_status = 'pending'
          AND j.return_date IS NOT NULL 
          AND j.return_date < ?
        ORDER BY j.return_date ASC LIMIT 5
      `, [todayStr]);

      // 3. Fetch Recent 6 Jobs
      const recentRes = await query<Job>(`
        SELECT j.*, c.name as customer_name, c.mobile as customer_mobile
        FROM jobs j
        JOIN customers c ON j.customer_id = c.id
        WHERE j.deleted_at IS NULL
        ORDER BY j.id DESC LIMIT 6
      `);

      if (statsRes.length > 0) {
        setStats({
          total_jobs: statsRes[0].total_jobs || 0,
          active_jobs: statsRes[0].active_jobs || 0,
          delivered_jobs: statsRes[0].delivered_jobs || 0,
          revenue_total: statsRes[0].revenue_total || 0,
          today_jobs: statsRes[0].today_jobs || 0,
          overdue_jobs_count: overdueRes.length
        });
      }

      setOverdueJobs(overdueRes);
      setRecentJobs(recentRes);

      // 4. Fetch Stock Inventory Summary
      try {
        const stockRes = await query<{
          total_parts: number;
          low_stock: number;
          out_of_stock: number;
          total_val: number;
        }>(`
          SELECT 
            COUNT(*) as total_parts,
            SUM(CASE WHEN quantity > 0 AND quantity <= min_threshold THEN 1 ELSE 0 END) as low_stock,
            SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) as out_of_stock,
            SUM(quantity * unit_cost) as total_val
          FROM inventory_items
        `);

        if (stockRes.length > 0) {
          setStockSummary({
            total_parts: stockRes[0].total_parts || 0,
            low_stock: stockRes[0].low_stock || 0,
            out_of_stock: stockRes[0].out_of_stock || 0,
            total_val: stockRes[0].total_val || 0
          });
        }
      } catch (e) {
        console.warn('Stock query warning:', e);
      }

      // Real computed revenue trend for past 7 days from jobs & transactions
      const realDays = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const isoDate = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });

        try {
          const dayJobRes = await query<{ day_rev: number; day_jobs: number }>(`
            SELECT 
              SUM(CASE WHEN payment_status = 'paid' THEN charges ELSE 0 END) as day_rev,
              COUNT(*) as day_jobs
            FROM jobs
            WHERE receive_date LIKE ? AND deleted_at IS NULL
          `, [`${isoDate}%`]);

          const finRes = await query<{ fin_rev: number }>(`
            SELECT SUM(amount) as fin_rev
            FROM financial_transactions
            WHERE date LIKE ? AND type = 'credit'
          `, [`${isoDate}%`]);

          const revFromJobs = (dayJobRes[0]?.day_rev || 0);
          const revFromFin = (finRes[0]?.fin_rev || 0);
          const totalDayRev = Math.max(revFromJobs, revFromFin);

          realDays.push({
            day: dayLabel,
            revenue: totalDayRev,
            jobs: dayJobRes[0]?.day_jobs || 0
          });
        } catch (err) {
          realDays.push({
            day: dayLabel,
            revenue: 0,
            jobs: 0
          });
        }
      }
      setRevenueTrend(realDays);

    } catch (e) {
      console.error('Failed to load dashboard statistics:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const paymentChartData = useMemo(
    () => [
      { name: 'Paid / Delivered', value: stats.delivered_jobs, color: '#10B981' },
      { name: 'Pending / Active', value: stats.active_jobs, color: '#F59E0B' }
    ],
    [stats.delivered_jobs, stats.active_jobs]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Top Banner */}
      <div className="card-container border-l-4 border-l-blue-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-md text-[10px] font-bold uppercase tracking-wider">
              System Operational
            </span>
            <span className="text-xs text-slate-400">• Local SQLite Engine</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 font-heading">
            Repair Workbench Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
            Monitor PC & Laptop repair intakes, active hardware queues, customer notifications, and shop revenue.
          </p>
        </div>
        <button
          onClick={() => navigate('/jobs')}
          className="btn-secondary shrink-0"
        >
          <span>View Repair Queue →</span>
        </button>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Systems */}
        <motion.div
          onClick={() => navigate('/jobs')}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs hover:border-blue-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Systems</span>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Laptop className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-3 font-heading">{stats.total_jobs}</p>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
            <span>+{stats.today_jobs} added today</span>
            <ArrowUpRight className="w-4 h-4 text-blue-500" />
          </div>
        </motion.div>

        {/* Active Repairs */}
        <motion.div
          onClick={() => navigate('/jobs?deliver_status=pending')}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs hover:border-amber-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Repairs</span>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-3 font-heading">{stats.active_jobs}</p>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
            <span>Pending delivery</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
        </motion.div>

        {/* Delivered Jobs */}
        <motion.div
          onClick={() => navigate('/jobs?deliver_status=delivered')}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs hover:border-emerald-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Delivered</span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-3 font-heading">{stats.delivered_jobs}</p>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
            <span>Returned</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </motion.div>

        {/* Stock Inventory KPI Card */}
        <motion.div
          onClick={() => navigate('/inventory')}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs hover:border-purple-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stock Parts</span>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-3 font-heading">{stockSummary.total_parts}</p>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
            {stockSummary.low_stock > 0 || stockSummary.out_of_stock > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5" />
                {stockSummary.low_stock + stockSummary.out_of_stock} low stock
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                Stock Healthy
              </span>
            )}
            <ArrowUpRight className="w-4 h-4 text-purple-500" />
          </div>
        </motion.div>

        {/* Total Revenue */}
        <motion.div
          onClick={() => navigate('/analytics')}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs hover:border-indigo-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-3 font-heading">{formatCurrency(stats.revenue_total)}</p>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
            <span>Paid charges</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
        </motion.div>
      </div>


      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Revenue Trend Area Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Revenue Trend (Past 7 Days)</h3>
              <p className="text-xs text-slate-500">Daily repair shop earnings analysis</p>
            </div>
            <button
              onClick={() => navigate('/analytics')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-500"
            >
              Full Analytics →
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  formatter={(val: any) => [`Rs. ${val}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Repair Status Donut Chart */}
        <div className="card-container flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delivery Distribution</h3>
            <p className="text-xs text-slate-500">Completed vs In-progress systems</p>
          </div>

          <div className="h-48 my-2 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {paymentChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <span className="text-xl font-black text-slate-900 dark:text-white">{stats.total_jobs}</span>
              <p className="text-[10px] uppercase font-bold text-slate-500">Total Jobs</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Delivered Jobs
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{stats.delivered_jobs}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Active Pending Jobs
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{stats.active_jobs}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue Jobs Alert & Recent Repairs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Jobs Alert Widget */}
        <div className="card-container">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/15 text-amber-600 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Overdue Return Jobs</h3>
                <p className="text-xs text-slate-500">Target return date passed & undelivered</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full text-xs font-bold">
              {overdueJobs.length} Alerts
            </span>
          </div>

          {overdueJobs.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium">No overdue jobs! All active repairs are within schedule.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {overdueJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center justify-between hover:bg-amber-100/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <TokenDisplay token={job.token_number} size="sm" />
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {job.customer_name} ({job.model || job.job_type})
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3.5 h-3.5" /> Due Date: {formatDate(job.return_date)}
                      </p>
                    </div>
                  </div>
                  <button className="btn-secondary py-1 px-2.5 text-xs">
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Repair Queue */}
        <div className="card-container">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Repair Intakes</h3>
              <p className="text-xs text-slate-500">Latest devices checked into shop</p>
            </div>
            <button
              onClick={() => navigate('/jobs')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-500"
            >
              View All →
            </button>
          </div>

          <div className="space-y-2.5">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <TokenDisplay token={job.token_number} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {job.model || `${job.job_type.toUpperCase()} System`}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {job.customer_name} • {job.customer_mobile}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge type="payment" status={job.payment_status} size="sm" />
                  <StatusBadge type="deliver" status={job.deliver_status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
