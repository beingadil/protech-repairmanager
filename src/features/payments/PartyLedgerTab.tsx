import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, User, Building2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { DropdownSelect } from '../../components/ui/DropdownSelect';
import { DataTable } from '../../components/ui/DataTable';
import { MoneyText } from '../../components/ui/MoneyText';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/utils';
import { loadPartyLedger, PartyLedgerRow } from '../../lib/finance';
import { exportFinancialTransactionsToCSV } from '../../lib/export-utils';
import { useFinanceData } from './hooks/useFinanceData';

interface PartyLedgerTabProps {
  finance: ReturnType<typeof useFinanceData>;
}

/**
 * Party Ledger tab — master-detail: searchable party list on the left, full
 * running-balance ledger on the right. Joins by customer ID (vouchers),
 * fixing the legacy name-string matching that broke on rename/duplicates.
 */
export const PartyLedgerTab: React.FC<PartyLedgerTabProps> = ({ finance }) => {
  const [partyFilter, setPartyFilter] = useState<'all' | 'customer' | 'supplier'>('all');
  const [partySearch, setPartySearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ledgerRows, setLedgerRows] = useState<PartyLedgerRow[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  useEffect(() => {
    finance.loadPartySummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredParties = useMemo(() => {
    const term = partySearch.trim().toLowerCase();
    return finance.partySummaries.filter((p) => {
      if (partyFilter !== 'all') {
        const isSupplier = p.party_type === 'supplier';
        if (partyFilter === 'supplier' && !isSupplier) return false;
        if (partyFilter === 'customer' && isSupplier) return false;
      }
      if (term && !p.name.toLowerCase().includes(term) && !p.mobile.includes(term)) return false;
      return true;
    });
  }, [finance.partySummaries, partyFilter, partySearch]);

  const selected = useMemo(
    () => finance.partySummaries.find((p) => p.id === selectedId) ?? null,
    [finance.partySummaries, selectedId]
  );

  useEffect(() => {
    if (selectedId == null) return;
    setIsLoadingLedger(true);
    loadPartyLedger(selectedId)
      .then(setLedgerRows)
      .catch(() => toast.error('Failed to load the party ledger.'))
      .finally(() => setIsLoadingLedger(false));
  }, [selectedId]);

  const runningLedger = useMemo(() => {
    let running = 0;
    return ledgerRows.map((r) => {
      running += r.type === 'receipt' ? r.amount : -r.amount;
      return { ...r, running };
    });
  }, [ledgerRows]);

  const partyColumns = [
    {
      key: 'name',
      header: 'Party',
      render: (p: (typeof finance.partySummaries)[number]) => (
        <div className="flex items-center gap-2 min-w-0">
          {p.party_type === 'supplier' ? (
            <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          ) : (
            <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          )}
          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
        </div>
      )
    },
    {
      key: 'net',
      header: 'Net',
      align: 'right' as const,
      render: (p: (typeof finance.partySummaries)[number]) => (
        <MoneyText amount={p.receipts - p.payments} tone="auto" bold />
      )
    }
  ];

  const ledgerColumns = [
    {
      key: 'date',
      header: 'Date',
      render: (r: { running: number } & PartyLedgerRow) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
          {formatDate(r.date)}
        </span>
      ),
      width: '100px'
    },
    {
      key: 'voucher',
      header: 'Voucher #',
      render: (r: { running: number } & PartyLedgerRow) => (
        <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
          {r.voucher_no}
        </span>
      ),
      width: '120px'
    },
    {
      key: 'description',
      header: 'Description',
      render: (r: { running: number } & PartyLedgerRow) => (
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-xs">
            {r.description}
          </p>
          {r.reference_token && (
            <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {r.reference_token}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'credit',
      header: 'Received (+)',
      align: 'right' as const,
      render: (r: { running: number } & PartyLedgerRow) =>
        r.type === 'receipt' ? <MoneyText amount={r.amount} tone="positive" bold /> : <span className="text-slate-300 dark:text-slate-600">—</span>,
      width: '130px'
    },
    {
      key: 'debit',
      header: 'Paid (-)',
      align: 'right' as const,
      render: (r: { running: number } & PartyLedgerRow) =>
        r.type === 'payment' ? <MoneyText amount={r.amount} tone="negative" bold /> : <span className="text-slate-300 dark:text-slate-600">—</span>,
      width: '130px'
    },
    {
      key: 'running',
      header: 'Running Balance',
      align: 'right' as const,
      render: (r: { running: number } & PartyLedgerRow) => (
        <MoneyText amount={r.running} bold tone="auto" />
      ),
      width: '140px'
    }
  ];

  const exportCsv = () => {
    if (!selected) return;
    // Reuse the CSV exporter shape with ledger rows mapped to legacy columns.
    exportFinancialTransactionsToCSV(
      runningLedger.map((r) => ({
        id: r.voucher_id,
        date: r.date,
        type: r.type === 'receipt' ? 'credit' : 'debit',
        amount: r.amount,
        category: '',
        payment_method: '',
        customer_name: r.type === 'receipt' ? selected.name : null,
        supplier_name: r.type === 'payment' ? selected.name : null,
        token_number: r.reference_token ?? null,
        description: r.description,
        notes: r.voucher_no
      })) as never
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card-container p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <input
            type="text"
            value={partySearch}
            onChange={(e) => setPartySearch(e.target.value)}
            placeholder="Search customer / supplier by name or mobile…"
            className="input-field"
            aria-label="Search parties"
          />
        </div>
        <DropdownSelect
          value={partyFilter}
          onChange={(v) => setPartyFilter(v as 'all' | 'customer' | 'supplier')}
          options={[
            { value: 'all', label: 'All Parties' },
            { value: 'customer', label: 'Customers Only' },
            { value: 'supplier', label: 'Suppliers Only' }
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* Master: party list */}
        <div className="lg:col-span-2">
          <div className="table-container">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Parties</h2>
              <span className="text-[11px] text-slate-500">{filteredParties.length} with activity</span>
            </div>
            <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredParties.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="w-5 h-5" />}
                  title="No parties with ledger activity"
                  description="Post a voucher to a party to open their ledger."
                />
              ) : (
                filteredParties.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                      selectedId === p.id
                        ? 'bg-slate-50 dark:bg-slate-800/60'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {p.party_type === 'supplier' ? (
                        <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {p.name}
                        </p>
                        {p.mobile && <p className="text-[11px] text-slate-400">{p.mobile}</p>}
                      </div>
                    </div>
                    <MoneyText amount={p.receipts - p.payments} tone="auto" bold />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Detail: running ledger */}
        <div className="lg:col-span-3 space-y-4">
          {!selected ? (
            <div className="card-container">
              <EmptyState
                icon={<BookOpen className="w-5 h-5" />}
                title="Select a party"
                description="Pick a customer or supplier to view their full running ledger."
              />
            </div>
          ) : isLoadingLedger ? (
            <SkeletonList rows={6} />
          ) : (
            <>
              <div className="card-container p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="muted-label">Party Ledger</p>
                  <h3 className="text-base font-black text-slate-900 dark:text-white font-heading">
                    {selected.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {selected.party_type === 'supplier' ? 'Market Supplier / Dealer' : 'Repair Customer'}
                    {selected.mobile ? ` • ${selected.mobile}` : ''} • {selected.entry_count} entries
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={exportCsv} icon={<Download className="w-4 h-4 text-slate-500" />}>
                    Export CSV
                  </Button>
                </div>
              </div>
              <DataTable
                columns={ledgerColumns}
                rows={runningLedger}
                rowKey={(r) => r.voucher_id}
                isLoading={isLoadingLedger}
                emptyTitle="No ledger entries for this party"
                page={1}
                pageSize={1000}
                totalRows={runningLedger.length}
                onPageChange={() => {}}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartyLedgerTab;
