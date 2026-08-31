import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Receipt, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { DropdownSelect } from '../../components/ui/DropdownSelect';
import { FilterBar } from '../../components/ui/FilterBar';
import { DataTable } from '../../components/ui/DataTable';
import { StatusPill, voucherTone } from '../../components/ui/StatusPill';
import { MoneyText } from '../../components/ui/MoneyText';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { formatDate } from '../../lib/utils';
import { deleteVoucher } from '../../lib/finance';
import { VoucherWithMeta } from '../../types/finance';
import { useFinanceData, PAGE_SIZE } from './hooks/useFinanceData';

interface VouchersTabProps {
  finance: ReturnType<typeof useFinanceData>;
  onNewVoucher: () => void;
  onEditInjected?: (v: VoucherWithMeta) => void;
}

/**
 * Vouchers tab of the Payments hub — paginated balanced-entry list with
 * type filters, instant search, and safe deletion (status re-derived from
 * remaining credits, never force-reverted).
 */
export const VouchersTab: React.FC<VouchersTabProps> = ({ finance, onNewVoucher }) => {
  const [deleteTarget, setDeleteTarget] = useState<VoucherWithMeta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isFiltered =
    finance.voucherTypeFilter !== 'all' || finance.voucherSearch.trim().length > 0;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteVoucher(deleteTarget.id);
      toast.success(`Voucher ${deleteTarget.voucher_no} deleted.`);
      setDeleteTarget(null);
      await Promise.all([finance.loadVoucherPage(), finance.refreshStats()]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete the voucher.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: 'voucher_no',
      header: 'Voucher #',
      render: (v: VoucherWithMeta) => (
        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
          {v.voucher_no}
        </span>
      ),
      width: '130px'
    },
    {
      key: 'date',
      header: 'Date',
      render: (v: VoucherWithMeta) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
          {formatDate(v.date)}
        </span>
      ),
      width: '110px'
    },
    {
      key: 'type',
      header: 'Type',
      render: (v: VoucherWithMeta) => (
        <StatusPill tone={voucherTone(v.type)} icon={v.type === 'receipt' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}>
          {v.type}
        </StatusPill>
      ),
      width: '110px'
    },
    {
      key: 'description',
      header: 'Description',
      render: (v: VoucherWithMeta) => (
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-xs">
            {v.description}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {v.reference_token && (
              <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {v.reference_token}
              </span>
            )}
            {v.notes && <span className="text-xs text-slate-400 truncate max-w-[160px]">{v.notes}</span>}
          </div>
        </div>
      )
    },
    {
      key: 'party',
      header: 'Party',
      render: (v: VoucherWithMeta) =>
        v.party_name ? (
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{v.party_name}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
      width: '140px'
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right' as const,
      render: (v: VoucherWithMeta) => (
        <MoneyText
          amount={v.total_amount ?? 0}
          bold
          tone={v.type === 'receipt' ? 'positive' : 'negative'}
          signed
        />
      ),
      width: '140px'
    },
    {
      key: 'actions',
      header: '',
      align: 'center' as const,
      render: (v: VoucherWithMeta) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTarget(v);
          }}
          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
          title={`Delete voucher ${v.voucher_no}`}
          aria-label={`Delete voucher ${v.voucher_no}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
      width: '60px'
    }
  ];

  return (
    <div className="space-y-4">
      <FilterBar
        search={finance.voucherSearch}
        onSearchChange={(v) => {
          finance.setVoucherSearch(v);
          finance.setVoucherPage(1);
        }}
        searchPlaceholder="Search voucher #, description, party, token…"
        isFiltered={isFiltered}
        onReset={() => {
          finance.setVoucherSearch('');
          finance.setVoucherTypeFilter('all');
          finance.setVoucherPage(1);
        }}
        summary={
          <span>
            <strong className="text-slate-800 dark:text-slate-200">{finance.voucherTotal}</strong>{' '}
            vouchers on record
          </span>
        }
      >
        <DropdownSelect
          value={finance.voucherTypeFilter}
          onChange={(v) => {
            finance.setVoucherTypeFilter(v as 'all' | 'receipt' | 'payment');
            finance.setVoucherPage(1);
          }}
          options={[
            { value: 'all', label: 'Type: All (Receipts & Payments)' },
            { value: 'receipt', label: 'Receipts (+) Money In' },
            { value: 'payment', label: 'Payments (-) Money Out' }
          ]}
        />
        <div className="sm:col-span-2 lg:col-span-2 flex justify-end">
          <Button onClick={onNewVoucher} icon={<Plus className="w-4 h-4" />}>
            New Voucher
          </Button>
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={finance.vouchers}
        rowKey={(v) => v.id}
        isLoading={finance.isLoadingVouchers}
        emptyIcon={<Receipt className="w-5 h-5" />}
        emptyTitle="No vouchers recorded yet"
        emptyDescription="Post your first receipt or payment to start the ledger."
        emptyAction={
          <Button onClick={onNewVoucher} icon={<Plus className="w-4 h-4" />}>
            New Voucher
          </Button>
        }
        page={finance.voucherPage}
        pageSize={PAGE_SIZE}
        totalRows={finance.voucherTotal}
        onPageChange={finance.setVoucherPage}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title="Delete Voucher"
        description={
          <>
            Delete <strong>{deleteTarget?.voucher_no}</strong> (
            {deleteTarget && (deleteTarget.total_amount ?? 0) > 0
              ? `${deleteTarget.type === 'receipt' ? 'receipt' : 'payment'} of `
              : ''}
            {deleteTarget && <MoneyText amount={deleteTarget.total_amount ?? 0} bold />})? Linked
            job payment status will be re-derived from the remaining credits.
          </>
        }
        confirmLabel="Delete Voucher"
      />
    </div>
  );
};

export default VouchersTab;
