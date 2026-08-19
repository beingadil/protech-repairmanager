import React, { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { query, execute } from '../../lib/db';
import { Job, PaymentStatus, DeliverStatus, JobType } from '../../types/job';
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
        SELECT j.*, c.name as customer_name, c.mobile as customer_mobile, c.address as customer_address
        FROM jobs j
        JOIN customers c ON j.customer_id = c.id
        WHERE j.deleted_at IS NULL
      `;
      const params: any[] = [];

      if (paymentFilter !== 'all') {
        sql += ' AND j.payment_status = ?';
        params.push(paymentFilter);
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

  // Quick Inline Status Toggles
  const togglePaymentStatus = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus: PaymentStatus = job.payment_status === 'paid' ? 'due' : 'paid';
    try {
      await execute('UPDATE jobs SET payment_status = ?, updated_at = datetime("now") WHERE id = ?', [
        newStatus,
        job.id
      ]);
      toast.success(`Job ${job.token_number} payment set to ${newStatus.toUpperCase()}`);
      fetchJobs();
    } catch {
      toast.error('Failed to update payment status.');
    }
  };

  const toggleDeliverStatus = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus: DeliverStatus = job.deliver_status === 'delivered' ? 'pending' : 'delivered';
    try {
      await execute('UPDATE jobs SET deliver_status = ?, updated_at = datetime("now") WHERE id = ?', [
        newStatus,
        job.id
      ]);
      toast.success(`Job ${job.token_number} delivery set to ${newStatus.toUpperCase()}`);
      fetchJobs();
    } catch {
      toast.error('Failed to update delivery status.');
    }
  };

  const handleDeleteJob = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to soft-delete repair record ${job.token_number}?`)) {
      try {
        await execute('UPDATE jobs SET deleted_at = datetime("now") WHERE id = ?', [job.id]);
        toast.success(`Job ${job.token_number} deleted.`);
        fetchJobs();
      } catch {
        toast.error('Failed to delete job.');
      }
    }
  };

  // Filter jobs client side by instant search keyword (supports typing "a" for single character matching)
  const filteredJobs = jobs.filter((j) => {
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
  });

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
              <option value="paid">Payment: PAID Only</option>
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
              <option value="pending">Delivery: PENDING Only</option>
              <option value="delivered">Delivery: DELIVERED Only</option>
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
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
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
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
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
                    No repair jobs found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job, idx) => {
                  const overdue = isOverdue(job.return_date, job.deliver_status);
                  return (
                    <motion.tr
                      key={job.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      {/* Token */}
                      <td className="py-3.5 px-4">
                        <TokenDisplay token={job.token_number} size="sm" />
                        {job.reference_token && (
                          <div className="mt-1">
                            <span className="inline-block px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-[10px] font-mono font-bold" title="Linked reference job">
                              Ref: {job.reference_token}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Customer info */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {job.customer_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{job.customer_mobile}</p>
                      </td>

                      {/* Specs */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-200">
                          {job.job_type === 'laptop' ? (
                            <Laptop className="w-4 h-4 text-blue-500 shrink-0" />
                          ) : (
                            <Monitor className="w-4 h-4 text-indigo-500 shrink-0" />
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

                      {/* Payment Status with quick click toggle */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={(e) => togglePaymentStatus(job, e)}
                          title="Click to toggle Paid/Due"
                          className="hover:scale-105 transition-transform cursor-pointer"
                        >
                          <StatusBadge type="payment" status={job.payment_status} size="sm" />
                        </button>
                      </td>

                      {/* Delivery Status with quick click toggle */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={(e) => toggleDeliverStatus(job, e)}
                          title="Click to toggle Pending/Delivered"
                          className="hover:scale-105 transition-transform cursor-pointer"
                        >
                          {overdue ? (
                            <StatusBadge type="overdue" size="sm" />
                          ) : (
                            <StatusBadge type="deliver" status={job.deliver_status} size="sm" />
                          )}
                        </button>
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
                    </motion.tr>
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

