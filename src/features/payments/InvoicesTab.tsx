import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Ban, CreditCard, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DropdownSelect } from '../../components/ui/DropdownSelect';
import { Modal } from '../../components/ui/Modal';
import { FilterBar } from '../../components/ui/FilterBar';
import { DataTable } from '../../components/ui/DataTable';
import { StatusPill, invoiceStatusTone } from '../../components/ui/StatusPill';
import { MoneyText } from '../../components/ui/MoneyText';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/utils';
import { query } from '../../lib/db';
import {
  createInvoiceFromJob,
  recordInvoicePayment,
  cancelInvoice
} from '../../lib/finance';
import { Job } from '../../types/job';
import { InvoiceWithMeta, Account } from '../../types/finance';
import { useFinanceData, PAGE_SIZE } from './hooks/useFinanceData';

interface InvoicesTabProps {
  finance: ReturnType<typeof useFinanceData>;
}

/**
 * Invoices tab — first-class INV-xxxxxx documents: create from an existing
 * job, record payments (which post balanced receipt vouchers), cancel, and
 * reprint via the existing print engine.
 */
export const InvoicesTab: React.FC<InvoicesTabProps> = ({ finance }) => {
  const navigate = useNavigate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [billableJobs, setBillableJobs] = useState<Job[]>([]);
  const [jobSearch, setJobSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [payTarget, setPayTarget] = useState<InvoiceWithMeta | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payAccountCode, setPayAccountCode] = useState(1000);
  const [isPaying, setIsPaying] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<InvoiceWithMeta | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const isFiltered = finance.invoiceStatusFilter !== 'all' || finance.invoiceSearch.trim().length > 0;

  // Load billable (non-deleted, not-complimentary) jobs when the create modal opens.
  useEffect(() => {
    if (!isCreateOpen) return;
    query<Job>(
      `SELECT j.*, c.name as customer_name FROM jobs j
       JOIN customers c ON j.customer_id = c.id
       WHERE j.deleted_at IS NULL AND j.payment_status != 'complimentary'
       ORDER BY j.id DESC LIMIT 200`
    )
      .then(setBillableJobs)
      .catch(() => toast.error('Failed to load jobs.'));
  }, [isCreateOpen]);

  const filteredJobs = useMemo(() => {
    const term = jobSearch.trim().toLowerCase();
    if (!term) return billableJobs;
    return billableJobs.filter(
      (j) =>
        j.token_number?.toLowerCase().includes(term) ||
        (j.customer_name || '').toLowerCase().includes(term) ||
        (j.model || '').toLowerCase().includes(term)
    );
  }, [billableJobs, jobSearch]);

  const handleCreate = async (job: Job) => {
    setIsCreating(true);
    try {
      const invoiceNo = await createInvoiceFromJob(job);
      toast.success(`Invoice ${invoiceNo} created for ${job.token_number}.`);
      setIsCreateOpen(false);
      setJobSearch('');
      await Promise.all([finance.loadInvoicePage(), finance.refreshStats()]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create invoice.');
    } finally {
      setIsCreating(false);
    }
  };

  const openPay = (inv: InvoiceWithMeta) => {
    const balance = Math.max(0, inv.net_amount - (inv.paid_amount ?? 0));
    setPayTarget(inv);
    setPayAmount(balance > 0 ? String(balance) : '');
    setPayAccountCode(1000);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    const amt = Math.max(0, parseFloat(payAmount) || 0);
    if (amt <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    setIsPaying(true);
    try {
      const voucherNo = await recordInvoicePayment(payTarget.id, {
        date: new Date().toISOString().split('T')[0],
        amount: amt,
        paymentAccountCode: payAccountCode
      });
      toast.success(`Receipt ${voucherNo} recorded against ${payTarget.invoice_no}.`);
      setPayTarget(null);
      await Promise.all([finance.loadInvoicePage(), finance.refreshStats()]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record the payment.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await cancelInvoice(cancelTarget.id);
      toast.success(`Invoice ${cancelTarget.invoice_no} cancelled.`);
      setCancelTarget(null);
      await finance.loadInvoicePage();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel the invoice.');
    } finally {
      setIsCancelling(false);
    }
  };

  const columns = [
    {
      key: 'invoice_no',
      header: 'Invoice #',
      render: (inv: InvoiceWithMeta) => (
        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
          {inv.invoice_no}
        </span>
      ),
      width: '130px'
    },
    {
      key: 'date',
      header: 'Date',
      render: (inv: InvoiceWithMeta) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
          {formatDate(inv.date)}
        </span>
      ),
      width: '110px'
    },
    {
      key: 'customer',
      header: 'Customer / Job',
      render: (inv: InvoiceWithMeta) => (
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{inv.customer_name}</p>
          {inv.token_number && (
            <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {inv.token_number}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'net',
      header: 'Net Amount',
      align: 'right' as const,
      render: (inv: InvoiceWithMeta) => <MoneyText amount={inv.net_amount} bold />,
      width: '130px'
    },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right' as const,
      render: (inv: InvoiceWithMeta) => <MoneyText amount={inv.paid_amount ?? 0} tone="positive" />,
      width: '130px'
    },
    {
      key: 'status',
      header: 'Status',
      render: (inv: InvoiceWithMeta) => (
        <StatusPill tone={invoiceStatusTone(inv.status)}>{inv.status}</StatusPill>
      ),
      width: '100px'
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (inv: InvoiceWithMeta) => {
        const balance = Math.max(0, inv.net_amount - (inv.paid_amount ?? 0));
        const open = inv.status !== 'cancelled' && inv.status !== 'paid';
        return (
          <div className="flex items-center justify-end gap-1.5">
            {inv.job_id && (
              <button
                type="button"
                onClick={() => navigate(`/jobs/${inv.job_id}/print?type=repair_job`)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Print / PDF"
                aria-label="Print invoice"
              >
                <FileText className="w-4 h-4" />
              </button>
            )}
            {open && balance > 0 && (
              <Button size="sm" variant="success" onClick={() => openPay(inv)} icon={<CreditCard className="w-3.5 h-3.5" />}>
                Record Payment
              </Button>
            )}
            {open && (inv.paid_amount ?? 0) === 0 && (
              <button
                type="button"
                onClick={() => setCancelTarget(inv)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                title="Cancel invoice"
                aria-label="Cancel invoice"
              >
                <Ban className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
      width: '200px'
    }
  ];

  return (
    <div className="space-y-4">
      <FilterBar
        search={finance.invoiceSearch}
        onSearchChange={(v) => {
          finance.setInvoiceSearch(v);
          finance.setInvoicePage(1);
        }}
        searchPlaceholder="Search invoice #, customer, token…"
        isFiltered={isFiltered}
        onReset={() => {
          finance.setInvoiceSearch('');
          finance.setInvoiceStatusFilter('all');
          finance.setInvoicePage(1);
        }}
        summary={
          <span>
            <strong className="text-slate-800 dark:text-slate-200">{finance.invoiceTotal}</strong>{' '}
            invoices on record
          </span>
        }
      >
        <DropdownSelect
          value={finance.invoiceStatusFilter}
          onChange={(v) => {
            finance.setInvoiceStatusFilter(v);
            finance.setInvoicePage(1);
          }}
          options={[
            { value: 'all', label: 'Status: All' },
            { value: 'issued', label: 'Unpaid (Issued)' },
            { value: 'partial', label: 'Partially Paid' },
            { value: 'paid', label: 'Paid' },
            { value: 'cancelled', label: 'Cancelled' }
          ]}
        />
        <div className="sm:col-span-2 lg:col-span-2 flex justify-end">
          <Button onClick={() => setIsCreateOpen(true)} icon={<Plus className="w-4 h-4" />}>
            Create Invoice
          </Button>
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={finance.invoices}
        rowKey={(inv) => inv.id}
        isLoading={finance.isLoadingInvoices}
        emptyIcon={<FileText className="w-5 h-5" />}
        emptyTitle="No invoices yet"
        emptyDescription="Create an invoice from a repair job to bill a customer formally."
        emptyAction={
          <Button onClick={() => setIsCreateOpen(true)} icon={<Plus className="w-4 h-4" />}>
            Create Invoice
          </Button>
        }
        page={finance.invoicePage}
        pageSize={PAGE_SIZE}
        totalRows={finance.invoiceTotal}
        onPageChange={finance.setInvoicePage}
      />

      {/* Create-from-job modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => !isCreating && setIsCreateOpen(false)}
        title="Create Invoice from Job"
        subtitle="Pick a repair job — charges & discount carry over automatically"
        size="lg"
      >
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={jobSearch}
            onChange={(e) => setJobSearch(e.target.value)}
            placeholder="Search by token, customer, model…"
            className="input-field pl-9"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {filteredJobs.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-5 h-5" />}
              title="No billable jobs found"
              description="Complimentary and deleted jobs are excluded."
            />
          ) : (
            filteredJobs.map((job) => (
              <button
                key={job.id}
                type="button"
                disabled={isCreating}
                onClick={() => handleCreate(job)}
                className="w-full card-container p-3.5 flex items-center justify-between gap-3 text-left hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-900 dark:text-white font-mono">
                    {job.token_number}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {job.customer_name} • {job.model || job.job_type}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <MoneyText amount={Number(job.charges) || 0} bold />
                  {Number(job.discount) > 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      discount {formatDiscount(job)}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* Record payment modal */}
      <Modal
        open={payTarget !== null}
        onClose={() => !isPaying && setPayTarget(null)}
        title={payTarget ? `Record Payment — ${payTarget.invoice_no}` : 'Record Payment'}
        subtitle={payTarget ? `${payTarget.customer_name} • Net ${formatMoney(payTarget.net_amount)}` : undefined}
        size="sm"
      >
        {payTarget && (
          <form onSubmit={handlePay} className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden bg-white dark:bg-slate-900 text-xs">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-semibold text-slate-500">Net Amount</span>
                <MoneyText amount={payTarget.net_amount} />
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-semibold text-slate-500">Already Paid</span>
                <MoneyText amount={payTarget.paid_amount ?? 0} tone="positive" />
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-bold text-slate-600 dark:text-slate-300 uppercase">Balance</span>
                <MoneyText
                  amount={Math.max(0, payTarget.net_amount - (payTarget.paid_amount ?? 0))}
                  bold
                  tone={payTarget.net_amount - (payTarget.paid_amount ?? 0) > 0 ? 'negative' : 'positive'}
                />
              </div>
            </div>
            <Input
              type="number"
              required
              min={1}
              label="Payment Amount (PKR)"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="[&_input]:font-bold"
            />
            <DropdownSelect
              label="Received In"
              required
              value={String(payAccountCode)}
              onChange={(v) => setPayAccountCode(Number(v))}
              options={finance.paymentAccounts.map((a: Account) => ({
                value: String(a.code),
                label: a.name
              }))}
            />
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setPayTarget(null)} disabled={isPaying}>
                Cancel
              </Button>
              <Button type="submit" loading={isPaying} variant="success" icon={<CreditCard className="w-4 h-4" />}>
                Record Payment
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={isCancelling}
        title="Cancel Invoice"
        description={
          <>
            Cancel <strong>{cancelTarget?.invoice_no}</strong> for{' '}
            {cancelTarget?.customer_name}? Only unpaid invoices can be cancelled.
          </>
        }
        confirmLabel="Cancel Invoice"
      />
    </div>
  );
};

function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })
    .format(n)
    .replace('PKR', 'Rs.');
}

function formatDiscount(job: Job): string {
  return `− ${formatMoney(Number(job.discount) || 0)}`;
}

export default InvoicesTab;
