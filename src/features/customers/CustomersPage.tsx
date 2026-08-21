import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  Building2,
  Phone,
  MapPin,
  Wrench,
  DollarSign,
  Download,
  Plus,
  X,
  Laptop,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  Edit2,
  Printer,
  Receipt,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { query, execute } from '../../lib/db';
import { Customer, PartyType } from '../../types/customer';
import { Job } from '../../types/job';
import { FinancialTransaction } from '../../types/payment';
import { formatCurrency, formatDate, isOverdue } from '../../lib/utils';
import { exportCustomersToCSV } from '../../lib/export-utils';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { TokenDisplay } from '../../components/shared/TokenDisplay';
import { useCustomersStore } from '../../store/customers';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>(() => useCustomersStore.getState().customers);
  const [search, setSearch] = useState('');
  const [typeTab, setTypeTab] = useState<'all' | 'customer' | 'supplier'>('all');
  const [isLoading, setIsLoading] = useState(useCustomersStore.getState().customers.length === 0);
  // Incremental grid rendering: large directories stay fast on tab switches
  const [visibleCount, setVisibleCount] = useState(24);

  // Selected party for detailed history view
  const [selectedParty, setSelectedParty] = useState<Customer | null>(null);
  const [partyJobs, setPartyJobs] = useState<Job[]>([]);
  const [partyTransactions, setPartyTransactions] = useState<FinancialTransaction[]>([]);
  const [historyTab, setHistoryTab] = useState<'laptops' | 'ledger'>('laptops');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Add / Edit Party Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Customer | null>(null);
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPartyType, setNewPartyType] = useState<PartyType>('customer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Payment Modal from history
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'credit' | 'debit'>('credit');
  const [paymentDesc, setPaymentDesc] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    setVisibleCount(24);
  }, [typeTab, search]);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await query<Customer>(`
        SELECT 
          c.*,
          COUNT(j.id) as total_jobs,
          SUM(CASE WHEN j.deliver_status = 'pending' AND j.deleted_at IS NULL THEN 1 ELSE 0 END) as pending_jobs,
          SUM(CASE WHEN j.deliver_status = 'delivered' AND j.deleted_at IS NULL THEN 1 ELSE 0 END) as delivered_jobs,
          SUM(CASE WHEN j.deleted_at IS NULL THEN j.charges ELSE 0 END) as total_billed,
          SUM(CASE WHEN j.payment_status = 'paid' AND j.deleted_at IS NULL THEN j.charges ELSE 0 END) as total_spent
        FROM customers c
        LEFT JOIN jobs j ON c.id = j.customer_id AND j.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY total_jobs DESC, c.id DESC
      `);
      setCustomers(res);
      useCustomersStore.getState().setCustomers(res);
    } catch (e) {
      console.error('Failed to load customer directory:', e);
      toast.error('Failed to load customers & suppliers.');
    } finally {
      setIsLoading(false);
    }
  };

  // Open party history drawer
  const handleOpenPartyHistory = async (party: Customer) => {
    setSelectedParty(party);
    setHistoryTab('laptops');
    setIsLoadingHistory(true);

    try {
      // 1. Fetch all jobs for this customer/supplier
      const jobs = await query<Job>(
        `SELECT j.*, c.name as customer_name, c.mobile as customer_mobile, c.address as customer_address
         FROM jobs j
         JOIN customers c ON j.customer_id = c.id
         WHERE j.customer_id = ? AND j.deleted_at IS NULL
         ORDER BY j.id DESC`,
        [party.id]
      );
      setPartyJobs(jobs);

      // 2. Fetch financial transactions
      const txs = await query<FinancialTransaction>(
        `SELECT * FROM financial_transactions 
         WHERE customer_name = ? OR supplier_name = ?
         ORDER BY date DESC, id DESC`,
        [party.name, party.name]
      );
      setPartyTransactions(txs);
    } catch (err) {
      console.error('Failed to load party history:', err);
      toast.error('Failed to load history details.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Add or update Customer / Supplier (single form, mode driven by editingParty)
  const closePartyForm = () => {
    setIsAddModalOpen(false);
    setEditingParty(null);
    setNewName('');
    setNewMobile('');
    setNewAddress('');
    setNewPartyType('customer');
  };

  const handleOpenEditParty = (party: Customer) => {
    setEditingParty(party);
    setNewName(party.name);
    setNewMobile(party.mobile || '');
    setNewAddress(party.address || '');
    setNewPartyType((party.party_type as PartyType) === 'supplier' ? 'supplier' : 'customer');
  };

  const handleAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Name is required!');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingParty) {
        await execute(
          'UPDATE customers SET name = ?, mobile = ?, address = ?, party_type = ?, updated_at = datetime("now") WHERE id = ?',
          [newName.trim(), newMobile.trim() || '03000000000', newAddress.trim() || '', newPartyType, editingParty.id]
        );
        toast.success(`"${newName.trim()}" updated!`);
      } else {
        await execute(
          'INSERT INTO customers (name, mobile, address, party_type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
          [newName.trim(), newMobile.trim() || '03000000000', newAddress.trim() || '', newPartyType]
        );
        toast.success(`${newPartyType === 'supplier' ? 'Market Supplier' : 'Customer'} "${newName}" added!`);
      }
      closePartyForm();
      loadCustomers();
    } catch (err) {
      console.error('Failed to save party:', err);
      toast.error('Failed to save record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Quick Payment / Ledger Entry for Party
  const handleQuickPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    try {
      const isCredit = paymentType === 'credit';
      await execute(
        `INSERT INTO financial_transactions (
          date, type, amount, category, payment_method, customer_name, supplier_name,
          description, notes, created_at, updated_at
        ) VALUES (date("now"), ?, ?, ?, 'cash', ?, ?, ?, ?, datetime("now"), datetime("now"))`,
        [
          paymentType,
          amt,
          isCredit ? 'repair_income' : 'market_supplier_payment',
          isCredit ? selectedParty.name : null,
          !isCredit ? selectedParty.name : null,
          paymentDesc || `${isCredit ? 'Payment received from' : 'Payment made to'} ${selectedParty.name}`,
          'Direct from Customer/Supplier profile'
        ]
      );

      toast.success(`Recorded ${formatCurrency(amt)} ${isCredit ? 'Credit (+)' : 'Debit (-)'} voucher!`);
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentDesc('');
      handleOpenPartyHistory(selectedParty);
      loadCustomers();
    } catch (err) {
      console.error('Failed to save quick payment:', err);
      toast.error('Failed to record voucher.');
    }
  };

  // Filtering
  const filtered = useMemo(() => {
    return customers.filter((c) => {
      // Tab filter
      if (typeTab === 'customer' && c.party_type === 'supplier') return false;
      if (typeTab === 'supplier' && c.party_type !== 'supplier') return false;

      // Instant search match
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        (c.mobile || '').includes(term) ||
        (c.address || '').toLowerCase().includes(term) ||
        (c.party_type || '').toLowerCase().includes(term)
      );
    });
  }, [customers, typeTab, search]);

  const customerCount = useMemo(() => customers.filter((c) => c.party_type !== 'supplier').length, [customers]);
  const supplierCount = useMemo(() => customers.filter((c) => c.party_type === 'supplier').length, [customers]);
  const visibleParties = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">
            Customer & Supplier Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage clients, market dealers, laptop handover history, pending repairs, and ledger balances
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportCustomersToCSV(filtered)}
            className="btn-secondary"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer / Supplier</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="card-container p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setTypeTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Parties ({customers.length})
            </button>
            <button
              onClick={() => setTypeTab('customer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeTab === 'customer'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Retail Customers ({customerCount})
            </button>
            <button
              onClick={() => setTypeTab('supplier')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeTab === 'supplier'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Market Suppliers / Dealers ({supplierCount})
            </button>
          </div>

          {/* Instant Search Box */}
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, shop/market location..."
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
        </div>
      </div>

      {/* Grid of Customer / Supplier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(isLoading && customers.length === 0) ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading directory records...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            No customer or supplier records found matching search.
          </div>
        ) : (
          visibleParties.map((c) => {
            const isSupplier = c.party_type === 'supplier';
            const pendingCount = c.pending_jobs || 0;
            const totalCount = c.total_jobs || 0;
            const balanceDue = (c.total_billed || 0) - (c.total_spent || 0);

            return (
              <div
                key={c.id}
                onClick={() => handleOpenPartyHistory(c)}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs space-y-3 cursor-pointer transition-all hover:shadow-md ${
                  isSupplier
                    ? 'border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500'
                    : 'border-slate-200/90 dark:border-slate-800/90 hover:border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isSupplier
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      {isSupplier ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white font-heading truncate max-w-[180px]">
                        {c.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-500" /> {c.mobile || 'No Phone'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isSupplier
                          ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      {isSupplier ? 'Supplier' : 'Customer'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditParty(c);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {c.address && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {c.address}
                  </p>
                )}

                {/* Metrics Badges: Total Laptops & Pending Laptops */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Laptops</span>
                    <span className="font-black text-sm text-slate-900 dark:text-white font-heading">
                      {totalCount} Units
                    </span>
                  </div>

                  <div
                    className={`p-2 rounded-xl text-center ${
                      pendingCount > 0
                        ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50'
                        : 'bg-slate-50 dark:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending In Shop</span>
                    <span
                      className={`font-black text-sm font-heading ${
                        pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {pendingCount} Pending
                    </span>
                  </div>
                </div>

                {/* Billed vs Balance */}
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total Billed:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(c.total_billed || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-semibold group-hover:underline pt-1">
                  <span>Click to view full laptop & payment history</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Load more for large directories */}
      {!isLoading && filtered.length > visibleParties.length && (
        <button
          onClick={() => setVisibleCount((n) => n + 24)}
          className="btn-secondary w-full"
        >
          Load More ({filtered.length - visibleParties.length} remaining)
        </button>
      )}

      {/* DETAILED HISTORY DRAWER / MODAL */}
      <AnimatePresence>
        {selectedParty && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-3xl h-full shadow-2xl flex flex-col justify-between overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${
                        selectedParty.party_type === 'supplier'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-blue-600 text-white shadow-md'
                      }`}
                    >
                      {selectedParty.party_type === 'supplier' ? (
                        <Building2 className="w-6 h-6" />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
                          {selectedParty.name}
                        </h2>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            selectedParty.party_type === 'supplier'
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                              : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {selectedParty.party_type === 'supplier' ? 'Market Supplier' : 'Retail Customer'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-emerald-500" /> {selectedParty.mobile || 'No Phone'}
                        </span>
                        {selectedParty.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" /> {selectedParty.address}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedParty(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Laptops</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white font-heading">
                      {partyJobs.length}
                    </span>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 text-center">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase block">
                      Pending In Shop
                    </span>
                    <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-heading">
                      {partyJobs.filter((j) => j.deliver_status === 'pending').length}
                    </span>
                  </div>

                  <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">
                      Delivered
                    </span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-heading">
                      {partyJobs.filter((j) => j.deliver_status === 'delivered').length}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Billed</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white font-heading">
                      {formatCurrency(partyJobs.reduce((acc, j) => acc + (j.charges || 0), 0))}
                    </span>
                  </div>
                </div>

                {/* Sub-Tabs: Laptop History vs Ledger Payments */}
                <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHistoryTab('laptops')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        historyTab === 'laptops'
                          ? 'bg-slate-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Laptop className="w-3.5 h-3.5 inline mr-1" />
                      Laptops / Devices History ({partyJobs.length})
                    </button>

                    <button
                      onClick={() => setHistoryTab('ledger')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        historyTab === 'ledger'
                          ? 'bg-slate-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Receipt className="w-3.5 h-3.5 inline mr-1" />
                      Ledger & Payments ({partyTransactions.length})
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setPaymentType(selectedParty.party_type === 'supplier' ? 'debit' : 'credit');
                      setIsPaymentModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Post Voucher</span>
                  </button>
                </div>
              </div>

              {/* Drawer Content Body */}
              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                {isLoadingHistory ? (
                  <div className="py-12 text-center text-slate-400">Loading history records...</div>
                ) : historyTab === 'laptops' ? (
                  partyJobs.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      No repair jobs registered for this customer/supplier yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {partyJobs.map((job) => {
                        const overdue = isOverdue(job.return_date, job.deliver_status);
                        return (
                          <div
                            key={job.id}
                            onClick={() => navigate(`/jobs/${job.id}`)}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <TokenDisplay token={job.token_number} size="sm" />
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {job.model || job.job_type.toUpperCase()}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <StatusBadge type="payment" status={job.payment_status} size="sm" />
                                {overdue ? (
                                  <StatusBadge type="overdue" size="sm" />
                                ) : (
                                  <StatusBadge type="deliver" status={job.deliver_status} size="sm" />
                                )}
                              </div>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              <strong>Issue:</strong> {job.symptoms}
                            </p>

                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <span>Rec: {formatDate(job.receive_date)} | Ret: {formatDate(job.return_date)}</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                Charges: {formatCurrency(job.charges)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  /* Ledger History */
                  partyTransactions.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      No ledger vouchers recorded for this party yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {partyTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                                  tx.type === 'credit'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                {tx.type.toUpperCase()}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{tx.description}</span>
                            </div>
                            <p className="text-slate-400 mt-0.5">{formatDate(tx.date)} • {tx.payment_method.toUpperCase()}</p>
                          </div>

                          <span
                            className={`font-black text-sm ${
                              tx.type === 'credit'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-end">
                <button
                  onClick={() => setSelectedParty(null)}
                  className="btn-secondary"
                >
                  Close History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD / EDIT CUSTOMER / SUPPLIER */}
      <AnimatePresence>
        {(isAddModalOpen || editingParty !== null) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-white font-heading">
                  {editingParty ? `Edit ${editingParty.party_type === 'supplier' ? 'Supplier' : 'Customer'}` : 'Add New Customer / Market Supplier'}
                </h3>
                <button
                  onClick={closePartyForm}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddParty} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Party Type *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewPartyType('customer')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                        newPartyType === 'customer'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" /> Retail Customer
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewPartyType('supplier')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                        newPartyType === 'supplier'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" /> Market Supplier / Dealer
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    {newPartyType === 'supplier' ? 'Supplier / Dealer Name *' : 'Customer Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={newPartyType === 'supplier' ? 'e.g. Al-Madina Computers Hafeez Center' : 'e.g. Tariq Mahmood'}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={newMobile}
                    onChange={(e) => setNewMobile(e.target.value)}
                    placeholder="0300-1234567"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Address / Market Location
                  </label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder={newPartyType === 'supplier' ? 'Hafeez Center 2nd Floor Lahore' : 'Gulberg, Lahore'}
                    className="input-field"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={closePartyForm}
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
                    <span>{editingParty ? 'Save Changes' : 'Save Party'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QUICK PAYMENT MODAL */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedParty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4"
            >
              <h3 className="font-bold text-base text-slate-900 dark:text-white font-heading">
                Post Voucher for {selectedParty.name}
              </h3>

              <form onSubmit={handleQuickPaymentSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Amount (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="input-field font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={paymentDesc}
                    onChange={(e) => setPaymentDesc(e.target.value)}
                    placeholder="e.g. Advance cash received"
                    className="input-field"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    Post Entry
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
