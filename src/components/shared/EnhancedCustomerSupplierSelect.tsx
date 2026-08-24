import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Building2,
  Phone,
  MapPin,
  Search,
  Plus,
  Check,
  ChevronDown,
  Wrench,
  Clock,
  PackageCheck,
  AlertCircle,
  X,
  ExternalLink,
  Tag,
  ArrowRight
} from 'lucide-react';
import { query, execute } from '../../lib/db';
import { Customer, PartyType } from '../../types/customer';
import { Job } from '../../types/job';
import { StatusBadge } from './StatusBadge';
import { TokenDisplay } from './TokenDisplay';
import { formatCurrency, formatDate } from '../../lib/utils';
import { toast } from 'sonner';

interface EnhancedCustomerSupplierSelectProps {
  selectedCustomerId?: number | null;
  onSelectParty: (party: Customer | null, previousJobs: Job[]) => void;
  onSelectReferenceJob?: (job: Job | null) => void;
  allowedType?: 'all' | 'customer' | 'supplier';
  label?: string;
  required?: boolean;
  showJobHistoryCard?: boolean;
}

export const EnhancedCustomerSupplierSelect: React.FC<EnhancedCustomerSupplierSelectProps> = ({
  selectedCustomerId = null,
  onSelectParty,
  onSelectReferenceJob,
  allowedType = 'all',
  label = 'Select Customer / Supplier *',
  required = true,
  showJobHistoryCard = true
}) => {
  const [parties, setParties] = useState<Customer[]>([]);
  const [selectedParty, setSelectedParty] = useState<Customer | null>(null);
  const [partyJobs, setPartyJobs] = useState<Job[]>([]);
  const [selectedRefJobId, setSelectedRefJobId] = useState<number | null>(null);

  // Dropdown UI States
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'customer' | 'supplier'>('all');
  const [isLoading, setIsLoading] = useState(false);

  // New Party Inline Modal / Form
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPartyType, setNewPartyType] = useState<PartyType>(
    allowedType === 'supplier' ? 'supplier' : 'customer'
  );
  const [isSavingNew, setIsSavingNew] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load parties list with job counts
  useEffect(() => {
    loadParties();
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When selectedCustomerId changes externally
  useEffect(() => {
    if (selectedCustomerId && parties.length > 0) {
      const found = parties.find((p) => p.id === selectedCustomerId);
      if (found) {
        handleSelectParty(found);
      }
    }
  }, [selectedCustomerId, parties]);

  const loadParties = async () => {
    setIsLoading(true);
    try {
      const sql = `
        SELECT 
          c.*,
          COUNT(j.id) as total_jobs,
          SUM(CASE WHEN j.deliver_status = 'pending' AND j.deleted_at IS NULL THEN 1 ELSE 0 END) as pending_jobs,
          SUM(CASE WHEN j.deliver_status = 'delivered' AND j.deleted_at IS NULL THEN 1 ELSE 0 END) as delivered_jobs
        FROM customers c
        LEFT JOIN jobs j ON c.id = j.customer_id AND j.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY c.name ASC
      `;
      const res = await query<Customer>(sql);
      setParties(res);
    } catch (e) {
      console.error('Failed to load customers/suppliers:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectParty = async (party: Customer) => {
    setSelectedParty(party);
    setIsOpen(false);
    setIsCreatingNew(false);

    // Fetch this party's complete repair job history
    try {
      const jobs = await query<Job>(
        'SELECT * FROM jobs WHERE customer_id = ? AND deleted_at IS NULL ORDER BY id DESC',
        [party.id]
      );
      setPartyJobs(jobs);
      onSelectParty(party, jobs);
    } catch (err) {
      console.error('Failed to load party jobs:', err);
      setPartyJobs([]);
      onSelectParty(party, []);
    }
  };

  const handleClearSelection = () => {
    setSelectedParty(null);
    setPartyJobs([]);
    setSelectedRefJobId(null);
    onSelectParty(null, []);
    if (onSelectReferenceJob) onSelectReferenceJob(null);
  };

  const handleCreateNewParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Name is required!');
      return;
    }

    setIsSavingNew(true);
    try {
      await execute(
        `INSERT INTO customers (name, mobile, address, party_type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [newName.trim(), newMobile.trim() || '0300-0000000', newAddress.trim() || '', newPartyType]
      );

      const res = await query<{ id: number }>('SELECT last_insert_rowid() as id');
      const newId = res[0].id;

      toast.success(`Registered new ${newPartyType === 'customer' ? 'Customer' : 'Supplier'}: ${newName}`);

      const createdParty: Customer = {
        id: newId,
        name: newName.trim(),
        mobile: newMobile.trim(),
        address: newAddress.trim(),
        party_type: newPartyType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_jobs: 0,
        pending_jobs: 0,
        delivered_jobs: 0
      };

      // Refresh list
      await loadParties();
      handleSelectParty(createdParty);
      setIsCreatingNew(false);
      setNewName('');
      setNewMobile('');
      setNewAddress('');
    } catch (err) {
      console.error('Failed to create new party:', err);
      toast.error('Failed to register customer/supplier.');
    } finally {
      setIsSavingNew(false);
    }
  };

  // Filter parties for dropdown
  const filteredParties = parties.filter((p) => {
    if (allowedType !== 'all' && (p.party_type || 'customer') !== allowedType) return false;
    if (activeTab !== 'all' && (p.party_type || 'customer') !== activeTab) return false;

    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(term) ||
        (p.mobile || '').toLowerCase().includes(term) ||
        (p.address || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="space-y-3" ref={dropdownRef}>
      {/* Label and Actions */}
      <div className="flex items-center justify-between">
        <label className="form-label">
          {label}
        </label>
        {!selectedParty && !isCreatingNew && (
          <button
            type="button"
            onClick={() => setIsCreatingNew(true)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> + Register New Client
          </button>
        )}
      </div>

      {/* 1. SELECTED PARTY DISPLAY CARD */}
      {selectedParty ? (
        <div className="bg-slate-50 dark:bg-slate-800/80 border-2 border-blue-500/40 dark:border-blue-500/50 rounded-2xl p-4 shadow-xs relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 ${
                  selectedParty.party_type === 'supplier'
                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-800'
                    : 'bg-gradient-to-br from-blue-600 to-blue-800'
                }`}
              >
                {selectedParty.party_type === 'supplier' ? (
                  <Building2 className="w-6 h-6" />
                ) : (
                  <User className="w-6 h-6" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-slate-900 dark:text-white font-heading">
                    {selectedParty.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      selectedParty.party_type === 'supplier'
                        ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        : 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {selectedParty.party_type === 'supplier' ? 'Market Supplier / Dealer' : 'Retail Customer'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 font-mono font-medium text-slate-700 dark:text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                    {selectedParty.mobile || 'No Phone'}
                  </span>
                  {selectedParty.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {selectedParty.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Change / Clear Button */}
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-400 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Change</span>
            </button>
          </div>

          {/* HISTORY SUMMARY BADGE BAR */}
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">Repair History:</span>
              <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md font-bold text-[11px]">
                {partyJobs.length} Total Jobs
              </span>
              {partyJobs.filter((j) => j.deliver_status === 'pending').length > 0 && (
                <span className="px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-md font-bold text-[11px] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  {partyJobs.filter((j) => j.deliver_status === 'pending').length} In-Shop Pending
                </span>
              )}
            </div>

            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              ✓ Saved Party Verified
            </span>
          </div>
        </div>
      ) : isCreatingNew ? (
        /* 2. INLINE REGISTER NEW CLIENT FORM */
        <div className="bg-slate-50 dark:bg-slate-800/80 border-2 border-dashed border-blue-500/60 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Register New Customer / Market Supplier
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Cancel & Select Existing
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Full Name / Shop Name *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Tariq Mehmood / Al-Madina Center"
                className="input-field text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Mobile Number *
              </label>
              <input
                type="text"
                required
                value={newMobile}
                onChange={(e) => setNewMobile(e.target.value)}
                placeholder="03001234567"
                className="input-field text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Party Type *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewPartyType('customer')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    newPartyType === 'customer'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => setNewPartyType('supplier')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    newPartyType === 'supplier'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Supplier
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Address / City
              </label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Munir Chowk, Gujranwala"
                className="input-field text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateNewParty}
              disabled={isSavingNew}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSavingNew ? 'Saving...' : 'Save & Select Client'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* 3. ENHANCED SEARCHABLE DROPDOWN TRIGGER */
        <div className="relative">
          <div
            onClick={() => setIsOpen(!isOpen)}
            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl flex items-center justify-between cursor-pointer shadow-xs transition-all"
          >
            <div className="flex items-center gap-2.5 text-slate-400">
              <Search className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Click to search and select saved customer or supplier...
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-semibold text-slate-600 dark:text-slate-400">
                {parties.length} Saved
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* DROPDOWN POPUP */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-80 flex flex-col"
              >
                {/* Search Bar & Filter Tabs */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Type name, phone (0300...), or address..."
                      className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Filter Pills */}
                  {allowedType === 'all' && (
                    <div className="flex items-center gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          activeTab === 'all'
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        All ({parties.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('customer')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          activeTab === 'customer'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Customers ({parties.filter((p) => p.party_type !== 'supplier').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('supplier')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          activeTab === 'supplier'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Suppliers / Dealers ({parties.filter((p) => p.party_type === 'supplier').length})
                      </button>
                    </div>
                  )}
                </div>

                {/* Parties Scroll List */}
                <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-60">
                  {filteredParties.length === 0 ? (
                    <div className="py-8 text-center px-4 space-y-2">
                      <p className="text-xs text-slate-400">No saved party found matching "{search}".</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewName(search);
                          setIsCreatingNew(true);
                          setIsOpen(false);
                        }}
                        className="btn-primary py-1.5 px-3 text-xs mx-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Register "{search || 'New Client'}" Now</span>
                      </button>
                    </div>
                  ) : (
                    filteredParties.map((party) => {
                      const isSupp = party.party_type === 'supplier';
                      return (
                        <button
                          type="button"
                          key={party.id}
                          onClick={() => handleSelectParty(party)}
                          className="w-full p-3 text-left hover:bg-blue-50/60 dark:hover:bg-slate-800/70 flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${
                                isSupp ? 'bg-indigo-600' : 'bg-blue-600'
                              }`}
                            >
                              {isSupp ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                  {party.name}
                                </span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                    isSupp
                                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300'
                                      : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300'
                                  }`}
                                >
                                  {isSupp ? 'Supplier' : 'Customer'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                <span className="font-mono text-[11px]">{party.mobile || 'No Phone'}</span>
                                {party.address && <span>• {party.address}</span>}
                              </div>
                            </div>
                          </div>

                          {/* Live Job Counters */}
                          <div className="text-right shrink-0">
                            {(party.total_jobs || 0) > 0 ? (
                              <div className="space-y-0.5">
                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-[10px] font-bold">
                                  {party.total_jobs} {party.total_jobs === 1 ? 'Job' : 'Jobs'}
                                </span>
                                {(party.pending_jobs || 0) > 0 && (
                                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    {party.pending_jobs} In-Shop
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">0 Prior Jobs</span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Bottom Register Action */}
                <div className="p-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Cannot find party in list?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(true);
                      setIsOpen(false);
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> + Add New Customer / Supplier
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 4. MULTIPLE REPAIR JOBS HISTORY & REFERENCE ACCORDION */}
      {selectedParty && showJobHistoryCard && partyJobs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Existing Client History ({partyJobs.length} Repair {partyJobs.length === 1 ? 'Job' : 'Jobs'} on File)
                </h4>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  {partyJobs.filter((j) => j.deliver_status === 'pending').length > 0
                    ? `⚠️ Client has ${partyJobs.filter((j) => j.deliver_status === 'pending').length} active machine(s) in shop right now!`
                    : 'All prior machines delivered.'}
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-lg">
              {partyJobs.length} Jobs Total
            </span>
          </div>

          {/* Job Cards Carousel / List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {partyJobs.map((job) => {
              const isSelectedRef = selectedRefJobId === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => {
                    const nextRefId = isSelectedRef ? null : job.id;
                    setSelectedRefJobId(nextRefId);
                    if (onSelectReferenceJob) {
                      onSelectReferenceJob(isSelectedRef ? null : job);
                    }
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left space-y-1.5 ${
                    isSelectedRef
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <TokenDisplay token={job.token_number} size="sm" />
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        job.deliver_status === 'pending'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {job.deliver_status}
                    </span>
                  </div>

                  <div>
                    <p
                      className={`text-xs font-bold truncate ${
                        isSelectedRef ? 'text-white' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {job.model || job.job_type}
                    </p>
                    <p
                      className={`text-[11px] truncate ${
                        isSelectedRef ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {job.symptoms}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className={isSelectedRef ? 'text-blue-100' : 'text-slate-400'}>
                      {formatDate(job.receive_date)}
                    </span>
                    <span
                      className={`font-bold ${
                        isSelectedRef ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatCurrency(job.charges)} ({job.payment_status.toUpperCase()})
                    </span>
                  </div>

                  {onSelectReferenceJob && (
                    <div className="pt-0.5 text-center">
                      <span
                        className={`text-[10px] font-bold ${
                          isSelectedRef ? 'text-blue-100 underline' : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {isSelectedRef ? '✓ Linked as Reference' : '+ Link as Reference'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};
