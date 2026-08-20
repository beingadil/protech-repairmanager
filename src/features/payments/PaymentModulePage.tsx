import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Receipt,
  FileText,
  User,
  Building2,
  X,
  CheckCircle2,
  PlusCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { query, execute } from '../../lib/db';
import {
  FinancialTransaction,
  TransactionType,
  PaymentCategory,
  PaymentMethod,
  MultiEntryRow,
  LedgerStats
} from '../../types/payment';
import { formatCurrency, formatDate } from '../../lib/utils';
import { exportFinancialTransactionsToCSV } from '../../lib/export-utils';
import { EnhancedCustomerSupplierSelect } from '../../components/shared/EnhancedCustomerSupplierSelect';
import { Job } from '../../types/job';

const CATEGORY_OPTIONS: { value: PaymentCategory; label: string; type: TransactionType }[] = [
  // Credit Categories (Income)
  { value: 'repair_income', label: 'Repair Charges Received', type: 'credit' },
  { value: 'advance_payment', label: 'Customer Advance Deposit', type: 'credit' },
  { value: 'parts_sale', label: 'Spare Parts Sale', type: 'credit' },
  { value: 'other_income', label: 'General / Other Income', type: 'credit' },

  // Debit Categories (Expense)
  { value: 'market_supplier_payment', label: 'Market Supplier / Dealer Payment', type: 'debit' },
  { value: 'parts_purchase', label: 'Inventory / Parts Purchase', type: 'debit' },
  { value: 'shop_rent_bills', label: 'Shop Rent & Utility Bills', type: 'debit' },
  { value: 'technician_salary', label: 'Technician Salary / Commission', type: 'debit' },
  { value: 'tools_equipment', label: 'Tools & Lab Equipment', type: 'debit' },
  { value: 'miscellaneous_expense', label: 'Miscellaneous Shop Expense', type: 'debit' }
];

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash in Hand' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'easypaisa', label: 'EasyPaisa' },
  { value: 'other', label: 'Other / Online' }
];

// Resolve the live job behind a reference token (used to link vouchers and to
// auto-mark the job as paid when a credit payment is received for it).
async function findJobIdByToken(token: string | null | undefined): Promise<number | null> {
  const t = (token || '').trim();
  if (!t) return null;
  const rows = await query<{ id: number }>(
    'SELECT id FROM jobs WHERE token_number = ? AND deleted_at IS NULL LIMIT 1',
    [t]
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function findCustomerIdByName(name: string): Promise<number | null> {
  const n = (name || '').trim();
  if (!n) return null;
  const rows = await query<{ id: number }>('SELECT id FROM customers WHERE name = ? LIMIT 1', [n]);
  return rows.length > 0 ? rows[0].id : null;
}

async function markJobPaidByToken(token: string | null | undefined): Promise<void> {
  const t = (token || '').trim();
  if (!t) return;
  await execute(
    "UPDATE jobs SET payment_status = 'paid', updated_at = datetime('now') WHERE token_number = ? AND deleted_at IS NULL",
    [t]
  );
}

async function revertJobToDueIfUnpaid(token: string | null | undefined, excludeTxId: number): Promise<void> {
  const t = (token || '').trim();
  if (!t) return;
  const remaining = await query<{ c: number }>(
    "SELECT COUNT(*) as c FROM financial_transactions WHERE type = 'credit' AND token_number = ? AND id != ?",
    [t, excludeTxId]
  );
  const count = remaining.length > 0 ? Number(remaining[0].c) : 0;
  if (count === 0) {
    await execute(
      "UPDATE jobs SET payment_status = 'due', updated_at = datetime('now') WHERE token_number = ? AND deleted_at IS NULL",
      [t]
    );
  }
}

export const PaymentModulePage: React.FC = () => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Stats
  const [stats, setStats] = useState<LedgerStats>({
    total_credit: 0,
    total_debit: 0,
    net_balance: 0,
    today_credit: 0,
    today_debit: 0,
    total_entries: 0
  });

  // Modal States
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);

  // Single Entry Form State
  const [entryType, setEntryType] = useState<TransactionType>('credit');
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [entryAmount, setEntryAmount] = useState<string>('');
  const [entryCategory, setEntryCategory] = useState<PaymentCategory>('repair_income');
  const [entryMethod, setEntryMethod] = useState<PaymentMethod>('cash');
  const [entryPartyId, setEntryPartyId] = useState<number | null>(null);
  const [entryPartyName, setEntryPartyName] = useState<string>('');
  const [entryTokenNumber, setEntryTokenNumber] = useState<string>('');
  const [entryDescription, setEntryDescription] = useState<string>('');
  const [entryNotes, setEntryNotes] = useState<string>('');
  const [partyJobsList, setPartyJobsList] = useState<Job[]>([]);
  const [allSavedParties, setAllSavedParties] = useState<{ id: number; name: string; party_type: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Multi Entry (Batch) Rows State
  const [multiRows, setMultiRows] = useState<MultiEntryRow[]>([
    {
      date: new Date().toISOString().split('T')[0],
      type: 'credit',
      amount: 0,
      category: 'repair_income',
      payment_method: 'cash',
      party_name: '',
      description: '',
      reference_token: '',
      notes: ''
    },
    {
      date: new Date().toISOString().split('T')[0],
      type: 'debit',
      amount: 0,
      category: 'market_supplier_payment',
      payment_method: 'cash',
      party_name: '',
      description: '',
      reference_token: '',
      notes: ''
    }
  ]);

  useEffect(() => {
    loadTransactions();
    loadAllSavedParties();
  }, []);

  const loadAllSavedParties = async () => {
    try {
      const parties = await query<{ id: number; name: string; party_type: string }>(
        'SELECT id, name, party_type FROM customers ORDER BY name ASC'
      );
      setAllSavedParties(parties);
    } catch (err) {
      console.warn('Failed to load saved parties:', err);
    }
  };

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const rows = await query<FinancialTransaction>(
        'SELECT * FROM financial_transactions ORDER BY date DESC, id DESC'
      );
      setTransactions(rows);
      calculateStats(rows);
    } catch (err) {
      console.error('Failed to load ledger transactions:', err);
      toast.error('Failed to load financial records.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (rows: FinancialTransaction[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    let totalCredit = 0;
    let totalDebit = 0;
    let todayCredit = 0;
    let todayDebit = 0;

    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      if (r.type === 'credit') {
        totalCredit += amt;
        if (r.date === todayStr) todayCredit += amt;
      } else if (r.type === 'debit') {
        totalDebit += amt;
        if (r.date === todayStr) todayDebit += amt;
      }
    }

    setStats({
      total_credit: totalCredit,
      total_debit: totalDebit,
      net_balance: totalCredit - totalDebit,
      today_credit: todayCredit,
      today_debit: todayDebit,
      total_entries: rows.length
    });
  };

  // Submit Single Entry
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(entryAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid amount greater than 0.');
      return;
    }
    if (!entryDescription.trim()) {
      toast.error('Please enter a description for this entry.');
      return;
    }

    setIsSubmitting(true);
    try {
      const refJobId = await findJobIdByToken(entryTokenNumber);
      await execute(
        `INSERT INTO financial_transactions (
          date, type, amount, category, payment_method, customer_id, customer_name, supplier_name,
          reference_job_id, token_number, description, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`,
        [
          entryDate,
          entryType,
          amountNum,
          entryCategory,
          entryMethod,
          entryType === 'credit' ? entryPartyId : null,
          entryType === 'credit' ? entryPartyName : null,
          entryType === 'debit' ? entryPartyName : null,
          refJobId,
          entryTokenNumber || null,
          entryDescription,
          entryNotes || null
        ]
      );

      if (entryType === 'credit') {
        await markJobPaidByToken(entryTokenNumber);
      }

      toast.success(
        `${entryType === 'credit' ? 'Credit (+)' : 'Debit (-)'} voucher of ${formatCurrency(amountNum)} recorded!`
      );
      setIsSingleModalOpen(false);
      resetSingleForm();
      loadTransactions();
    } catch (err) {
      console.error('Failed to record financial transaction:', err);
      toast.error('Failed to save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSingleForm = () => {
    setEntryAmount('');
    setEntryPartyName('');
    setEntryTokenNumber('');
    setEntryDescription('');
    setEntryNotes('');
    setEntryCategory('repair_income');
    setEntryType('credit');
  };

  // Submit Multi (Batch) Entries
  const handleMultiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = multiRows.filter((r) => r.amount > 0 && r.description.trim());

    if (validRows.length === 0) {
      toast.error('Please fill at least one row with amount and description.');
      return;
    }

    setIsSubmitting(true);
    try {
      for (const row of validRows) {
        const partyId = await findCustomerIdByName(row.party_name);
        const refJobId = await findJobIdByToken(row.reference_token);
        await execute(
          `INSERT INTO financial_transactions (
            date, type, amount, category, payment_method, customer_id, customer_name, supplier_name,
            reference_job_id, token_number, description, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`,
          [
            row.date || new Date().toISOString().split('T')[0],
            row.type,
            row.amount,
            row.category,
            row.payment_method,
            row.type === 'credit' ? partyId : null,
            row.type === 'credit' ? row.party_name : null,
            row.type === 'debit' ? row.party_name : null,
            refJobId,
            row.reference_token || null,
            row.description,
            row.notes || null
          ]
        );

        if (row.type === 'credit') {
          await markJobPaidByToken(row.reference_token);
        }
      }

      toast.success(`Successfully posted ${validRows.length} batch ledger entries!`);
      setIsMultiModalOpen(false);
      setMultiRows([
        {
          date: new Date().toISOString().split('T')[0],
          type: 'credit',
          amount: 0,
          category: 'repair_income',
          payment_method: 'cash',
          party_name: '',
          description: '',
          reference_token: '',
          notes: ''
        }
      ]);
      loadTransactions();
    } catch (err) {
      console.error('Failed to record batch entries:', err);
      toast.error('Failed to save batch entries.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add row to multi entry table
  const addMultiRow = () => {
    setMultiRows([
      ...multiRows,
      {
        date: new Date().toISOString().split('T')[0],
        type: 'debit',
        amount: 0,
        category: 'market_supplier_payment',
        payment_method: 'cash',
        party_name: '',
        description: '',
        reference_token: '',
        notes: ''
      }
    ]);
  };

  // Remove row from multi entry table
  const removeMultiRow = (idx: number) => {
    if (multiRows.length <= 1) return;
    setMultiRows(multiRows.filter((_, i) => i !== idx));
  };

  // Update specific field in multi row
  const updateMultiRow = (idx: number, field: keyof MultiEntryRow, val: any) => {
    const updated = [...multiRows];
    updated[idx] = { ...updated[idx], [field]: val };
    if (field === 'type') {
      // Auto-set default appropriate category
      if (val === 'credit') updated[idx].category = 'repair_income';
      else updated[idx].category = 'market_supplier_payment';
    }
    setMultiRows(updated);
  };

  // Delete transaction with confirmation
  const handleDeleteTransaction = async (tx: FinancialTransaction) => {
    if (confirm(`Delete ledger entry #${tx.id} (${tx.description} - ${formatCurrency(tx.amount)})?`)) {
      try {
        await execute('DELETE FROM financial_transactions WHERE id = ?', [tx.id]);
        if (tx.type === 'credit') {
          await revertJobToDueIfUnpaid(tx.token_number, tx.id);
        }
        toast.success(`Transaction #${tx.id} deleted.`);
        loadTransactions();
      } catch (err) {
        console.error('Failed to delete transaction:', err);
        toast.error('Failed to delete entry.');
      }
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    // Type filter
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

    // Category filter
    if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;

    // Date range filter
    if (dateRangeFilter !== 'all') {
      const txDate = new Date(tx.date);
      const now = new Date();
      if (dateRangeFilter === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        if (tx.date !== todayStr) return false;
      } else if (dateRangeFilter === 'week') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
        if (txDate < sevenDaysAgo) return false;
      } else if (dateRangeFilter === 'month') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
        if (txDate < thirtyDaysAgo) return false;
      }
    }

    // Keyword search (single letter instant match like typing "a")
    if (search.trim()) {
      const term = search.toLowerCase();
      const match =
        tx.description.toLowerCase().includes(term) ||
        (tx.customer_name || '').toLowerCase().includes(term) ||
        (tx.supplier_name || '').toLowerCase().includes(term) ||
        (tx.token_number || '').toLowerCase().includes(term) ||
        (tx.category || '').toLowerCase().includes(term) ||
        (tx.payment_method || '').toLowerCase().includes(term) ||
        (tx.notes || '').toLowerCase().includes(term) ||
        tx.amount.toString().includes(term);
      if (!match) return false;
    }

    return true;
  });

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
            Accounts & Payment Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dedicated Credit & Debit financial ledger with multi-entry vouchers and market supplier payouts
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportFinancialTransactionsToCSV(filteredTransactions)}
            className="btn-secondary"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsMultiModalOpen(true)}
            className="btn-secondary text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/40"
          >
            <Receipt className="w-4 h-4" />
            <span>Multi-Row Batch Entry</span>
          </button>

          <button
            onClick={() => {
              setEntryType('credit');
              setIsSingleModalOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>New Voucher Entry</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Net Cash Balance, Total Credit, Total Debit, Today Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Balance */}
        <div className="card-container p-4 flex items-center justify-between border-l-4 border-l-slate-500">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Net Shop Balance
            </p>
            <h3
              className={`text-xl font-black font-heading mt-1 ${
                stats.net_balance >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(stats.net_balance)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Total Inflow minus Outflow</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* Total Credit (Income) */}
        <div className="card-container p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Credit (Inflow)
            </p>
            <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-heading mt-1">
              +{formatCurrency(stats.total_credit)}
            </h3>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-500 mt-0.5">
              Today: +{formatCurrency(stats.today_credit)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Total Debit (Expense) */}
        <div className="card-container p-4 flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Debit (Outflow)
            </p>
            <h3 className="text-xl font-black text-rose-600 dark:text-rose-400 font-heading mt-1">
              -{formatCurrency(stats.total_debit)}
            </h3>
            <p className="text-[11px] text-rose-700 dark:text-rose-500 mt-0.5">
              Today: -{formatCurrency(stats.today_debit)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        {/* Total Entries Count */}
        <div className="card-container p-4 flex items-center justify-between border-l-4 border-l-slate-500">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Ledger Entries
            </p>
            <h3 className="text-xl font-black text-slate-900 dark:text-white font-heading mt-1">
              {stats.total_entries} Records
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Active double-entry vouchers</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <FileText className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card-container p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Instant Search Bar */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, customer/supplier, token (PTS-001)..."
              className="input-field pl-9"
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

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="input-field cursor-pointer"
            >
              <option value="all">Type: All (Credit & Debit)</option>
              <option value="credit">Credit (+) Income Only</option>
              <option value="debit">Debit (-) Expenses Only</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value as any)}
              className="input-field cursor-pointer"
            >
              <option value="all">Date: All Time</option>
              <option value="today">Date: Today Only</option>
              <option value="week">Date: Last 7 Days</option>
              <option value="month">Date: Last 30 Days</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-field cursor-pointer"
            >
              <option value="all">Category: All Categories</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.type === 'credit' ? '[+] ' : '[-] '} {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Results Summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span>
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredTransactions.length}</strong> of{' '}
            {transactions.length} ledger entries
          </span>
          {(typeFilter !== 'all' || categoryFilter !== 'all' || dateRangeFilter !== 'all' || search) && (
            <button
              onClick={() => {
                setTypeFilter('all');
                setCategoryFilter('all');
                setDateRangeFilter('all');
                setSearch('');
              }}
              className="text-slate-600 dark:text-slate-300 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Description / Details</th>
                <th className="py-3 px-4">Party (Customer / Supplier)</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Credit (+)</th>
                <th className="py-3 px-4 text-right">Debit (-)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading financial ledger database...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No ledger transactions found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isCredit = tx.type === 'credit';
                  return (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Date */}
                      <td className="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isCredit
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                          }`}
                        >
                          {isCredit ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3" /> CREDIT
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3" /> DEBIT
                            </>
                          )}
                        </span>
                      </td>

                      {/* Description & Token */}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{tx.description}</p>
                        {tx.token_number && (
                          <span className="inline-block mt-0.5 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            Token: {tx.token_number}
                          </span>
                        )}
                        {tx.notes && <p className="text-xs text-slate-400 truncate mt-0.5">{tx.notes}</p>}
                      </td>

                      {/* Party */}
                      <td className="py-3 px-4 text-xs">
                        {tx.customer_name ? (
                          <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-medium">
                            <User className="w-3.5 h-3.5 text-blue-500" /> {tx.customer_name}
                          </span>
                        ) : tx.supplier_name ? (
                          <span className="flex items-center gap-1 text-indigo-700 dark:text-indigo-300 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500" /> {tx.supplier_name}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 capitalize">
                        {tx.category.replace(/_/g, ' ')}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4 text-xs">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px] font-medium uppercase tracking-wide">
                          {tx.payment_method.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Credit Amount */}
                      <td className="py-3 px-4 text-right font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        {isCredit ? formatCurrency(tx.amount) : '—'}
                      </td>

                      {/* Debit Amount */}
                      <td className="py-3 px-4 text-right font-bold text-sm text-rose-600 dark:text-rose-400">
                        {!isCredit ? formatCurrency(tx.amount) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteTransaction(tx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Delete Voucher"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Single Voucher Entry */}
      <AnimatePresence>
        {isSingleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-white font-heading">
                    New Financial Voucher Entry
                  </h3>
                </div>
                <button
                  onClick={() => setIsSingleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSingleSubmit} className="space-y-4">
                {/* Credit vs Debit Switch */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Transaction Flow *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEntryType('credit');
                        setEntryCategory('repair_income');
                      }}
                      className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                        entryType === 'credit'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <ArrowDownLeft className="w-4 h-4" /> CREDIT (Money In / Income)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEntryType('debit');
                        setEntryCategory('market_supplier_payment');
                      }}
                      className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                        entryType === 'debit'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" /> DEBIT (Money Out / Expense)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Amount (PKR) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={entryAmount}
                      onChange={(e) => setEntryAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      className="input-field font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Category *
                    </label>
                    <select
                      value={entryCategory}
                      onChange={(e) => setEntryCategory(e.target.value as PaymentCategory)}
                      className="input-field"
                    >
                      {CATEGORY_OPTIONS.filter((c) => c.type === entryType).map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Payment Account / Method *
                    </label>
                    <select
                      value={entryMethod}
                      onChange={(e) => setEntryMethod(e.target.value as PaymentMethod)}
                      className="input-field"
                    >
                      {METHOD_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Enhanced Customer / Supplier Selector */}
                <div>
                  <EnhancedCustomerSupplierSelect
                    selectedCustomerId={entryPartyId}
                    allowedType={entryType === 'credit' ? 'all' : 'supplier'}
                    label={entryType === 'credit' ? 'Customer / Party Name *' : 'Market Supplier / Payee Name *'}
                    showJobHistoryCard={false}
                    onSelectParty={(party, jobs) => {
                      if (party) {
                        setEntryPartyId(party.id);
                        setEntryPartyName(party.name);
                        setPartyJobsList(jobs || []);
                        if (jobs && jobs.length > 0) {
                          // If party has jobs and none selected yet, offer the first
                          toast.info(`Found ${jobs.length} repair jobs for ${party.name}`);
                        }
                      } else {
                        setEntryPartyId(null);
                        setEntryPartyName('');
                        setPartyJobsList([]);
                        setEntryTokenNumber('');
                      }
                    }}
                    onSelectReferenceJob={(job) => {
                      if (job) {
                        setEntryTokenNumber(job.token_number);
                        if (!entryAmount || entryAmount === '0') {
                          setEntryAmount(job.charges.toString());
                        }
                        if (!entryDescription) {
                          setEntryDescription(`Repair charges for ${job.token_number} (${job.model || job.job_type})`);
                        }
                      }
                    }}
                  />
                </div>

                {/* Reference Token / Linked Repair Job Selector */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                      Reference Repair Job / Token (Optional)
                    </label>
                    {partyJobsList.length > 0 && (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-full">
                        {partyJobsList.length} Job{partyJobsList.length > 1 ? 's' : ''} on record
                      </span>
                    )}
                  </div>

                  {partyJobsList.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        value={entryTokenNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEntryTokenNumber(val);
                          const matchedJob = partyJobsList.find((j) => j.token_number === val);
                          if (matchedJob) {
                            if (!entryAmount || entryAmount === '0') {
                              setEntryAmount(matchedJob.charges.toString());
                            }
                            setEntryDescription(`Repair charges for ${matchedJob.token_number} (${matchedJob.model || matchedJob.job_type})`);
                          }
                        }}
                        className="input-field font-medium text-xs"
                      >
                        <option value="">-- No Specific Job (General Ledger Entry) --</option>
                        {partyJobsList.map((job) => (
                          <option key={job.id} value={job.token_number}>
                            {job.token_number} — {job.model || job.job_type} | Charges: {formatCurrency(job.charges)} ({job.payment_status.toUpperCase()})
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">Or enter custom token:</span>
                        <input
                          type="text"
                          value={entryTokenNumber}
                          onChange={(e) => setEntryTokenNumber(e.target.value)}
                          placeholder="e.g. PTS-001"
                          className="input-field text-xs py-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={entryTokenNumber}
                      onChange={(e) => setEntryTokenNumber(e.target.value)}
                      placeholder="e.g. PTS-001 or general reference"
                      className="input-field text-xs"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Description / Purpose *
                  </label>
                  <input
                    type="text"
                    required
                    value={entryDescription}
                    onChange={(e) => setEntryDescription(e.target.value)}
                    placeholder="e.g. Received full repair charges for Dell XPS laptop"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Additional Notes
                  </label>
                  <input
                    type="text"
                    value={entryNotes}
                    onChange={(e) => setEntryNotes(e.target.value)}
                    placeholder="e.g. Paid via JazzCash TxID: 9812498"
                    className="input-field"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSingleModalOpen(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Post Voucher</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Multi-Row Batch Entry */}
      <AnimatePresence>
        {isMultiModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-5xl w-full space-y-5 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white font-heading">
                      Multi-Row Batch Ledger Entry
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Quickly input multiple Credit & Debit transactions at once
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMultiModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Rows Form */}
              <form onSubmit={handleMultiSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="overflow-y-auto flex-1 pr-1 space-y-3">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase">
                        <th className="p-2 w-12">#</th>
                        <th className="p-2 w-28">Flow</th>
                        <th className="p-2 w-28">Date</th>
                        <th className="p-2 w-32">Amount (PKR)</th>
                        <th className="p-2 w-44">Category</th>
                        <th className="p-2 w-32">Method</th>
                        <th className="p-2 w-40">Party Name</th>
                        <th className="p-2">Description</th>
                        <th className="p-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {multiRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 font-bold text-slate-400">{idx + 1}</td>

                          {/* Flow Type */}
                          <td className="p-2">
                            <select
                              value={row.type}
                              onChange={(e) => updateMultiRow(idx, 'type', e.target.value as TransactionType)}
                              className={`p-1.5 rounded-lg border text-xs font-bold outline-none ${
                                row.type === 'credit'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700'
                              }`}
                            >
                              <option value="credit">CREDIT (+)</option>
                              <option value="debit">DEBIT (-)</option>
                            </select>
                          </td>

                          {/* Date */}
                          <td className="p-2">
                            <input
                              type="date"
                              required
                              value={row.date}
                              onChange={(e) => updateMultiRow(idx, 'date', e.target.value)}
                              className="w-full p-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                            />
                          </td>

                          {/* Amount */}
                          <td className="p-2">
                            <input
                              type="number"
                              required
                              min={1}
                              value={row.amount || ''}
                              onChange={(e) => updateMultiRow(idx, 'amount', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full p-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold"
                            />
                          </td>

                          {/* Category */}
                          <td className="p-2">
                            <select
                              value={row.category}
                              onChange={(e) => updateMultiRow(idx, 'category', e.target.value as PaymentCategory)}
                              className="w-full p-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                            >
                              {CATEGORY_OPTIONS.filter((c) => c.type === row.type).map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Method */}
                          <td className="p-2">
                            <select
                              value={row.payment_method}
                              onChange={(e) => updateMultiRow(idx, 'payment_method', e.target.value as PaymentMethod)}
                              className="w-full p-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                            >
                              {METHOD_OPTIONS.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Party Name */}
                          <td className="p-2">
                            <input
                              type="text"
                              list="saved-parties-datalist"
                              value={row.party_name}
                              onChange={(e) => updateMultiRow(idx, 'party_name', e.target.value)}
                              placeholder="Select / Type Party"
                              className="w-full p-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                            />
                          </td>

                          {/* Description */}
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              value={row.description}
                              onChange={(e) => updateMultiRow(idx, 'description', e.target.value)}
                              placeholder="Description"
                              className="w-full p-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                            />
                          </td>

                          {/* Delete */}
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeMultiRow(idx)}
                              className="text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <button
                    type="button"
                    onClick={addMultiRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer mt-2"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>+ Add Another Entry Row</span>
                  </button>
                </div>

                {/* Footer and Summary */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 mt-3">
                  <div className="text-xs text-slate-500 space-x-3">
                    <span>
                      Total Credit:{' '}
                      <strong className="text-emerald-600">
                        {formatCurrency(
                          multiRows.filter((r) => r.type === 'credit').reduce((acc, r) => acc + (r.amount || 0), 0)
                        )}
                      </strong>
                    </span>
                    <span>
                      Total Debit:{' '}
                      <strong className="text-rose-600">
                        {formatCurrency(
                          multiRows.filter((r) => r.type === 'debit').reduce((acc, r) => acc + (r.amount || 0), 0)
                        )}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsMultiModalOpen(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Post All Batch Entries</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Datalist for autocomplete */}
              <datalist id="saved-parties-datalist">
                {allSavedParties.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.party_type === 'supplier' ? '🏢 [Supplier]' : '👤 [Customer]'} {p.name}
                  </option>
                ))}
              </datalist>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
