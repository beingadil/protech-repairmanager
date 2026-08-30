import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Search,
  Plus,
  Filter,
  Download,
  Eye,
  Edit2,
  Printer,
  MessageSquare,
  Trash2,
  Laptop,
  Monitor,
  Check,
  Clock,
  RotateCcw,
  X,
  Wrench
} from 'lucide-react';
import { toast } from 'sonner';
import { query, execute } from '../../lib/db';
import { Job, DeliverStatus, JobType } from '../../types/job';
import { formatCurrency, formatDate, isOverdue } from '../../lib/utils';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { TokenDisplay } from '../../components/shared/TokenDisplay';
import { exportJobsToCSV } from '../../lib/export-utils';

export const JobListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>(searchParams.get('payment_status') || 'all');
  const [deliverFilter, setDeliverFilter] = useState<string>(searchParams.get('deliver_status') || 'all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchJobs();
  }, [paymentFilter, deliverFilter, typeFilter]);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      let sql = `
        SELECT j.*, c.name as customer_name, c.mobile as customer_mobile, c.address as customer_address,
          COALESCE((
            SELECT SUM(ft.amount) FROM financial_transactions ft
            WHERE ft.type = 'credit' AND ft.token_number = j.token_number
          ), 0) as paid_amount
        FROM jobs j
        JOIN customers c ON j.customer_id = c.id
        WHERE j.deleted_at IS NULL
      `;
      const params: any[] = [];

      if (paymentFilter !== 'all') {
        if (paymentFilter === 'partial') {
          // Part-paid: 'due' status but cashbook credits received against it
          sql += ` AND j.payment_status = 'due' AND COALESCE((SELECT SUM(ft.amount) FROM financial_transactions ft WHERE ft.type = 'credit' AND ft.token_number = j.token_number), 0) > 0 AND COALESCE((SELECT SUM(ft.amount) FROM financial_transactions ft WHERE ft.type = 'credit' AND ft.token_number = j.token_number), 0) + COALESCE(j.discount, 0) < j.charges`;
        } else {
          sql += ' AND j.payment_status = ?';
          params.push(paymentFilter);
        }
      }
      if (deliverFilter !== 'all') {
        sql += ' AND j.deliver_status = ?';
        params.push(deliverFilter);
      }
      if (typeFilter !== 'all') {
        sql += ' AND j.job_type = ?';
        params.push(typeFilter);
      }

      sql += ' ORDER BY j.id DESC';

      const results = await query<Job>(sql, params);
      setJobs(results);
    } catch (e) {
      console.error('Failed to fetch jobs:', e);
      toast.error('Failed to load repair jobs.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Inline Status Dropdowns
  const updateDeliverStatus = async (job: Job, newStatus: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    try {
      await execute(`UPDATE jobs SET deliver_status = ?, updated_at = datetime('now') WHERE id = ?`, [
        newStatus,
        job.id
      ]);
      toast.success(`Job ${job.token_number} → ${newStatus.replace('_', ' ').toUpperCase()}`);
      fetchJobs();
    } catch {
      toast.error('Failed to update delivery status.');
    }
  };

  const updatePaymentStatus = async (job: Job, newStatus: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    try {
      // Complimentary = mark as paid but do NOT create a financial transaction
      await execute(`UPDATE jobs SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`, [
        newStatus,
        job.id
      ]);
      const label = newStatus === 'complimentary' ? 'COMPLIMENTARY (No Payment)' : newStatus.toUpperCase();
      toast.success(`Job ${job.token_number} → ${label}`);
      fetchJobs();
    } catch {
      toast.error('Failed to update payment status.');
    }
  };

  const handleDeleteJob = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to soft-delete repair record ${job.token_number}?`)) {
      try {
        await execute(`UPDATE jobs SET deleted_at = datetime('now') WHERE id = ?`, [job.id]);
        toast.success(`Job ${job.token_number} deleted.`);
        fetchJobs();
      } catch {
        toast.error('Failed to delete job.');
      }
    }
  };

  // Filter jobs client side by instant search keyword (supports typing "a" for single character matching)
  const filteredJobs = useMemo(() => jobs.filter((j) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      j.token_number.toLowerCase().includes(term) ||
      (j.customer_name || '').toLowerCase().includes(term) ||
      (j.customer_mobile || '').includes(term) ||
      (j.customer_address || '').toLowerCase().includes(term) ||
      (j.model || '').toLowerCase().includes(term) ||
      (j.serial_no || '').toLowerCase().includes(term) ||
      (j.processor || '').toLowerCase().includes(term) ||
      (j.ram || '').toLowerCase().includes(term) ||
      (j.hard || '').toLowerCase().includes(term) ||
      (j.symptoms || '').toLowerCase().includes(term) ||
      (j.notes || '').toLowerCase().includes(term) ||
      j.charges.toString().includes(term)
    );
  }), [jobs, search]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">
            Repair Jobs Master List
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage all PC and Laptop repair records with quick filters and status controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportJobsToCSV(filteredJobs)}
            className="btn-secondary"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => navigate('/jobs/new')}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>New Repair Job</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card-container p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token (PTS-001), customer, phone, specs, symptoms..."
              className="input-field pl-9 pr-8"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Payment Filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="input-field cursor-pointer"
            >
              <option value="all">Payment: All</option>
              <option value="due">Payment: DUE Only</option>
              <option value="partial">Payment: PARTIAL (Part Paid)</option>
              <option value="paid">Payment: PAID Only</option>
              <option value="complimentary">Payment: COMPLIMENTARY</option>
            </select>
          </div>

          {/* Delivery Filter */}
          <div>
            <select
              value={deliverFilter}
              onChange={(e) => setDeliverFilter(e.target.value)}
              className="input-field cursor-pointer"
            >
              <option value="all">Delivery: All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="in_diagnostics">In Diagnostics</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>

          {/* Job Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-field cursor-pointer"
            >
              <option value="all">Type: Laptop & PC</option>
              <option value="laptop">Type: Laptop Only</option>
              <option value="pc">Type: Desktop PC Only</option>
            </select>
          </div>
        </div>

        {/* Counter summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span>
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredJobs.length}</strong> of {jobs.length} total jobs
          </span>
          {(paymentFilter !== 'all' || deliverFilter !== 'all' || typeFilter !== 'all' || search) && (
            <button
              onClick={() => {
                setPaymentFilter('all');
                setDeliverFilter('all');
                setTypeFilter('all');
                setSearch('');
              }}
              className="text-slate-600 dark:text-slate-300 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Jobs Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Token #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Device Specs</th>
                <th className="py-3 px-4">Receive / Return</th>
                <th className="py-3 px-4">Charges</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Delivery</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading repair database records...
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Wrench className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">No repair jobs found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search terms</p>
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const overdue = isOverdue(job.return_date, job.deliver_status);
                  return (
                    <tr
                      key={job.id}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      {/* Token */}
                      <td className="py-3.5 px-4">
                        <TokenDisplay token={job.token_number} size="sm" />
                        {job.reference_token && (
                          <div className="mt-1">
                            <span className="inline-block px-1.5 py-0.2 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-mono font-bold" title="Linked reference job">
                              Ref: {job.reference_token}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Customer info */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                          {job.customer_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{job.customer_mobile}</p>
                      </td>

                      {/* Specs */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-200">
                          {job.job_type === 'laptop' ? (
                            <Laptop className="w-4 h-4 text-slate-500 shrink-0" />
                          ) : (
                            <Monitor className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <span className="truncate">{job.model || job.job_type.toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {job.processor ? `${job.processor} • ` : ''}
                          {job.ram ? `${job.ram} • ` : ''}
                          {job.serial_no ? `S/N: ${job.serial_no}` : ''}
                        </p>
                      </td>

                      {/* Dates */}
                      <td className="py-3.5 px-4 text-xs space-y-0.5">
                        <div className="text-slate-600 dark:text-slate-300">Rec: {formatDate(job.receive_date)}</div>
                        <div className={overdue ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400'}>
                          Ret: {formatDate(job.return_date)}
                        </div>
                      </td>

                      {/* Charges */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {formatCurrency(job.charges)}
                      </td>

                      {/* Payment Status — inline dropdown + remaining balance hint */}
                      <td className="py-3.5 px-4">
                        <select
                          value={job.payment_status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updatePaymentStatus(job, e.target.value, e)}
                          className="text-xs font-bold rounded-full border px-2 py-1 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400/30 dark:focus:ring-slate-500/30"
                        >
                          <option value="due">⏳ Due</option>
                          <option value="paid">✅ Paid</option>
                          <option value="complimentary">💜 No Payment</option>
                        </select>
                        {(() => {
                          const paid = Number((job as Job & { paid_amount?: number }).paid_amount) || 0;
                          const charges = Math.max(0, Number(job.charges) || 0);
                          const discount = Math.max(0, Number((job as Job & { discount?: number }).discount) || 0);
                          const remaining = Math.max(0, charges - discount - paid);
                          if (job.payment_status === 'due' && paid > 0 && remaining > 0) {
                            return (
                              <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                {formatCurrency(remaining)} remaining
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </td>

                      {/* Delivery Status with inline dropdown */}
                      <td className="py-3.5 px-4">
                        {overdue ? (
                          <StatusBadge type="overdue" size="sm" />
                        ) : (
                          <select
                            value={job.deliver_status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateDeliverStatus(job, e.target.value, e)}
                            className="text-xs font-bold rounded-full border px-2 py-1 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400/30 dark:focus:ring-slate-500/30"
                          >
                            <option value="pending">⏳ Pending</option>
                            <option value="in_progress">🔧 In Progress</option>
                            <option value="in_diagnostics">🔍 Diagnostics</option>
                            <option value="ready">📦 Ready</option>
                            <option value="delivered">✅ Delivered</option>
                          </select>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/jobs/${job.id}`);
                            }}
                            className="btn-ghost"
                            title="View Job Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/jobs/${job.id}/edit`);
                            }}
                            className="btn-ghost"
                            title="Edit Record"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/jobs/${job.id}/print`);
                            }}
                            className="btn-ghost"
                            title="Print Card / Invoice"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteJob(job, e)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

