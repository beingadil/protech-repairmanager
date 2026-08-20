import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Search,
  Download,
  User,
  Building2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { query } from '../../lib/db';
import { FinancialTransaction } from '../../types/payment';
import { formatCurrency, formatDate } from '../../lib/utils';
import { exportFinancialTransactionsToCSV } from '../../lib/export-utils';

type PartyType = 'customer' | 'supplier' | 'both';

interface PartySummary {
  name: string;
  type: PartyType;
  credit: number;
  debit: number;
  count: number;
}

interface LedgerRow {
  tx: FinancialTransaction;
  running: number;
}

export const GeneralLedgerPage: React.FC = () => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [customerInfo, setCustomerInfo] = useState<Record<string, { party_type: string; mobile: string }>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [partyTypeFilter, setPartyTypeFilter] = useState<'all' | 'customer' | 'supplier'>('all');
  const [partySearch, setPartySearch] = useState('');
  const [selectedParty, setSelectedParty] = useState<PartySummary | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txRows, customers] = await Promise.all([
        query<FinancialTransaction>('SELECT * FROM financial_transactions ORDER BY date DESC, id DESC'),
        query<{ id: number; name: string; party_type: string; mobile: string }>(
          'SELECT id, name, party_type, mobile FROM customers'
        )
      ]);
      setTransactions(txRows);
      const info: Record<string, { party_type: string; mobile: string }> = {};
      for (const c of customers) {
        info[c.name.trim()] = { party_type: c.party_type || 'customer', mobile: c.mobile || '' };
      }
      setCustomerInfo(info);
    } catch (err) {
      console.error('Failed to load ledger data:', err);
      toast.error('Failed to load ledger records.');
    } finally {
      setIsLoading(false);
    }
  };

  const parties = useMemo<PartySummary[]>(() => {
    const map = new Map<string, PartySummary>();
    for (const tx of transactions) {
      const amt = Number(tx.amount) || 0;
      if (tx.customer_name && tx.customer_name.trim()) {
        const name = tx.customer_name.trim();
        const p = map.get(name) || { name, type: 'customer' as PartyType, credit: 0, debit: 0, count: 0 };
        if (p.type === 'supplier') p.type = 'both';
        if (tx.type === 'credit') p.credit += amt;
        else p.debit += amt;
        p.count += 1;
        map.set(name, p);
      }
      if (tx.supplier_name && tx.supplier_name.trim()) {
        const name = tx.supplier_name.trim();
        const p = map.get(name) || { name, type: 'supplier' as PartyType, credit: 0, debit: 0, count: 0 };
        if (p.type === 'customer') p.type = 'both';
        if (tx.type === 'credit') p.credit += amt;
        else p.debit += amt;
        p.count += 1;
        map.set(name, p);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions]);

  const filteredParties = useMemo(() => {
    const term = partySearch.trim().toLowerCase();
    return parties.filter((p) => {
      if (partyTypeFilter !== 'all' && p.type !== partyTypeFilter && p.type !== 'both') return false;
      if (term && !p.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [parties, partyTypeFilter, partySearch]);

  const selectedLedger = useMemo<LedgerRow[]>(() => {
    if (!selectedParty) return [];
    let running = 0;
    return transactions
      .filter((tx) => {
        const isCustomerSide = selectedParty.type !== 'supplier' && tx.customer_name === selectedParty.name;
        const isSupplierSide = selectedParty.type !== 'customer' && tx.supplier_name === selectedParty.name;
        return isCustomerSide || isSupplierSide;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .map((tx) => {
        const amt = Number(tx.amount) || 0;
        running += tx.type === 'credit' ? amt : -amt;
        return { tx, running };
      });
  }, [transactions, selectedParty]);

  const selectedStats = useMemo(() => {
    let credit = 0;
    let debit = 0;
    for (const { tx } of selectedLedger) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'credit') credit += amt;
      else debit += amt;
    }
    return { credit, debit, net: credit - debit, entries: selectedLedger.length };
  }, [selectedLedger]);

  const selectParty = (p: PartySummary) => {
    setSelectedParty(p);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">
            General Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Detailed running ledgers for every customer and supplier — pick a party to see full history
          </p>
        </div>
        {selectedParty && (
          <button
            onClick={() => exportFinancialTransactionsToCSV(selectedLedger.map((r) => r.tx))}
            className="btn-secondary"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export Ledger CSV</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card-container p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={partySearch}
              onChange={(e) => setPartySearch(e.target.value)}
              placeholder="Search customer / supplier..."
              className="input-field pl-9 pr-8"
            />
            {partySearch && (
              <button
                onClick={() => setPartySearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div>
            <select
              value={partyTypeFilter}
              onChange={(e) => {
                const next = e.target.value as typeof partyTypeFilter;
                setPartyTypeFilter(next);
                if (selectedParty) {
                  const okType = selectedParty.type === 'both' || selectedParty.type === next;
                  if (next !== 'all' && !okType) setSelectedParty(null);
                }
              }}
              className="input-field cursor-pointer"
            >
              <option value="all">All Parties</option>
              <option value="customer">Customers Only</option>
              <option value="supplier">Suppliers Only</option>
            </select>
          </div>

          <div>
            <select
              value={selectedParty ? `${selectedParty.type}:${selectedParty.name}` : ''}
              onChange={(e) => {
                const [type, ...rest] = e.target.value.split(':');
                const name = rest.join(':');
                if (!name) {
                  setSelectedParty(null);
                  return;
                }
                const party = parties.find((p) => p.name === name && (p.type === type || p.type === 'both'));
                if (party) setSelectedParty(party);
              }}
              className="input-field cursor-pointer"
            >
              <option value="">-- Select a Party to View Ledger --</option>
              {filteredParties.map((p) => (
                <option key={p.name} value={`${p.type}:${p.name}`}>
                  {p.name} ({p.type === 'supplier' ? 'Supplier' : p.type === 'both' ? 'Customer + Supplier' : 'Customer'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span>
            <strong className="text-slate-800 dark:text-slate-200">{filteredParties.length}</strong> of {parties.length} parties with ledger activity
          </span>
          {selectedParty && (
            <button
              onClick={() => setSelectedParty(null)}
              className="text-slate-600 dark:text-slate-300 hover:underline font-semibold"
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Selected Party KPIs */}
      {selectedParty ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-container p-4 flex items-center justify-between border-l-4 border-l-slate-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Party</p>
              <h3 className="text-base font-black text-slate-900 dark:text-white font-heading mt-1 truncate max-w-40">
                {selectedParty.name}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedParty.type === 'supplier'
                  ? 'Market Supplier / Dealer'
                  : selectedParty.type === 'both'
                    ? 'Customer & Supplier'
                    : 'Repair Customer'}
                {customerInfo[selectedParty.name]?.mobile ? ` • ${customerInfo[selectedParty.name].mobile}` : ''}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              {selectedParty.type === 'supplier' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
          </div>

          <div className="card-container p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Received (Credit)
              </p>
              <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-heading mt-1">
                +{formatCurrency(selectedStats.credit)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Money received / income</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="card-container p-4 flex items-center justify-between border-l-4 border-l-rose-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Paid (Debit)
              </p>
              <h3 className="text-xl font-black text-rose-600 dark:text-rose-400 font-heading mt-1">
                -{formatCurrency(selectedStats.debit)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Money paid out / expense</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>

          <div className="card-container p-4 flex items-center justify-between border-l-4 border-l-slate-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Net Ledger Balance
              </p>
              <h3
                className={`text-xl font-black font-heading mt-1 ${
                  selectedStats.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(selectedStats.net)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{selectedStats.entries} ledger entries</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="card-container p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          Select a customer or supplier above (or from the list below) to open their detailed ledger.
        </div>
      )}

      {/* Party Summary Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading">All Party Ledgers</h2>
          <span className="text-[11px] text-slate-500">Click a row to view full ledger</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Party</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Total Received (+)</th>
                <th className="py-3 px-4 text-right">Total Paid (-)</th>
                <th className="py-3 px-4 text-right">Net Balance</th>
                <th className="py-3 px-4 text-center">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading ledger database...
                  </td>
                </tr>
              ) : filteredParties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No parties found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredParties.map((p) => {
                  const isSelected = selectedParty?.name === p.name;
                  const balance = p.credit - p.debit;
                  return (
                    <tr
                      key={p.name}
                      onClick={() => selectParty(p)}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-slate-50/70 dark:bg-slate-800/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{p.name}</span>
                        {customerInfo[p.name]?.mobile && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">{customerInfo[p.name].mobile}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {p.type === 'supplier' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                            <Building2 className="w-3 h-3" /> SUPPLIER
                          </span>
                        ) : p.type === 'both' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                            <User className="w-3 h-3" /> CUSTOMER + SUPPLIER
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                            <User className="w-3 h-3" /> CUSTOMER
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(p.credit)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                        -{formatCurrency(p.debit)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-black ${
                          balance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {formatCurrency(balance)}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-slate-500 dark:text-slate-400">{p.count}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Party Detailed Ledger */}
      {selectedParty && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
              Full Ledger — {selectedParty.name}
            </h2>
            <span className="text-[11px] text-slate-500">Running balance in PKR</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description / Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Credit (+)</th>
                  <th className="py-3 px-4 text-right">Debit (-)</th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {selectedLedger.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No ledger entries for this party.
                    </td>
                  </tr>
                ) : (
                  selectedLedger.map(({ tx, running }) => {
                    const isCredit = tx.type === 'credit';
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isCredit
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                            }`}
                          >
                            {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {isCredit ? 'CREDIT' : 'DEBIT'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{tx.description}</p>
                          {tx.token_number && (
                            <span className="inline-block mt-0.5 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              Token: {tx.token_number}
                            </span>
                          )}
                          {tx.notes && <p className="text-xs text-slate-400 truncate mt-0.5">{tx.notes}</p>}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 capitalize">
                          {tx.category.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px] font-medium uppercase tracking-wide">
                            {tx.payment_method.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {isCredit ? formatCurrency(tx.amount) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-sm text-rose-600 dark:text-rose-400">
                          {!isCredit ? formatCurrency(tx.amount) : '—'}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-black text-sm ${
                            running >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatCurrency(running)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
};