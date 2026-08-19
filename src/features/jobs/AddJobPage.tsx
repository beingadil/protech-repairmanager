import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Laptop,
  Monitor,
  Calendar,
  DollarSign,
  FileText,
  Save,
  Printer,
  ArrowLeft,
  Tag,
  CheckCircle2,
  Cpu,
  HardDrive,
  Layers,
  Plug,
  Boxes,
  Plus,
  Trash2,
  Building2,
  User,
  Check,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../../store/settings';
import { EnhancedCustomerSupplierSelect } from '../../components/shared/EnhancedCustomerSupplierSelect';
import { EnhancedDatePicker } from '../../components/common/EnhancedDatePicker';
import { query, execute, getNextPTSToken } from '../../lib/db';
import { JobType, PaymentStatus, DeliverStatus, Job } from '../../types/job';
import { TokenDisplay } from '../../components/shared/TokenDisplay';
import { formatCurrency } from '../../lib/utils';

interface BulkLaptopRow {
  id: string;
  model: string;
  serialNo: string;
  ram: string;
  hard: string;
  processor: string;
  symptoms: string;
  charges: number;
  hasCharger: number;
  paymentStatus: PaymentStatus;
  deliverStatus: DeliverStatus;
  notes: string;
}

export const AddJobPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useSettingsStore();

  // Intake Mode: 'single' | 'bulk_supplier'
  const [intakeMode, setIntakeMode] = useState<'single' | 'bulk_supplier'>('single');

  // Single Job State
  const [tokenNumber, setTokenNumber] = useState<string>('PTS-001');
  const [referenceToken, setReferenceToken] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [jobType, setJobType] = useState<JobType>('laptop');
  const [model, setModel] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [ram, setRam] = useState('');
  const [hard, setHard] = useState('');
  const [processor, setProcessor] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [receiveDate, setReceiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState<string>(
    new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
  );
  const [charges, setCharges] = useState<number>(parseInt(settings.default_charges || '1500', 10));
  const [hasCharger, setHasCharger] = useState<number>(1);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('due');
  const [deliverStatus, setDeliverStatus] = useState<DeliverStatus>('pending');
  const [notes, setNotes] = useState('');

  // Bulk Market Supplier State
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [supplierMobile, setSupplierMobile] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [bulkReceiveDate, setBulkReceiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bulkReturnDate, setBulkReturnDate] = useState<string>(
    new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]
  );

  const [bulkRows, setBulkRows] = useState<BulkLaptopRow[]>([
    {
      id: 'row-1',
      model: '',
      serialNo: '',
      ram: '8GB DDR4',
      hard: '256GB SSD',
      processor: 'Intel Core i5',
      symptoms: 'No Power / Board Short',
      charges: 2000,
      hasCharger: 0,
      paymentStatus: 'due',
      deliverStatus: 'pending',
      notes: 'Market dealer unit 1'
    },
    {
      id: 'row-2',
      model: '',
      serialNo: '',
      ram: '16GB DDR4',
      hard: '512GB SSD',
      processor: 'Intel Core i7',
      symptoms: 'Display flickering / white screen',
      charges: 2500,
      hasCharger: 0,
      paymentStatus: 'due',
      deliverStatus: 'pending',
      notes: 'Market dealer unit 2'
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Generate fresh PTS token
    getNextPTSToken().then(setTokenNumber);
  }, []);

  // Submit Single Job
  const handleSingleSubmit = async (andPrint: boolean = false) => {
    if (!customerName.trim()) {
      toast.error('Customer or Supplier name is required!');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Refresh token right before insert to guarantee uniqueness
      const currentToken = await getNextPTSToken();

      // 2. Save or retrieve customer
      let finalCustomerId = selectedCustomerId;
      if (!finalCustomerId) {
        const existingCust = await query<{ id: number }>(
          'SELECT id FROM customers WHERE (mobile = ? AND mobile != "") OR name = ? LIMIT 1',
          [customerMobile, customerName]
        );

        if (existingCust.length > 0) {
          finalCustomerId = existingCust[0].id;
        } else {
          await execute(
            'INSERT INTO customers (name, mobile, address, party_type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
            [customerName, customerMobile || '03000000000', customerAddress || '', 'customer']
          );
          const newCustRes = await query<{ id: number }>('SELECT last_insert_rowid() as id');
          finalCustomerId = newCustRes[0].id;
        }
      }

      const safeCharges = isNaN(Number(charges)) ? 0 : Number(charges);

      // 3. Insert Job Record
      await execute(
        `INSERT INTO jobs (
          token_number, customer_id, job_type, serial_no, model, ram, hard, processor,
          symptoms, receive_date, return_date, charges, has_charger, payment_status, deliver_status, notes, reference_token, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`,
        [
          currentToken,
          finalCustomerId,
          jobType,
          serialNo || '',
          model || `${jobType.toUpperCase()} Device`,
          ram || '',
          hard || '',
          processor || '',
          symptoms || 'General service / checking',
          receiveDate,
          returnDate,
          safeCharges,
          hasCharger,
          paymentStatus,
          deliverStatus,
          notes || '',
          referenceToken || null
        ]
      );

      const jobRes = await query<{ id: number }>('SELECT last_insert_rowid() as id');
      const newJobId = jobRes[0].id;

      // 4. If initial payment was paid, log credit transaction to financial ledger
      if (paymentStatus === 'paid' && safeCharges > 0) {
        await execute(
          `INSERT INTO financial_transactions (
            date, type, amount, category, payment_method, customer_name,
            token_number, description, notes, created_at, updated_at
          ) VALUES (?, 'credit', ?, 'repair_income', 'cash', ?, ?, ?, ?, datetime("now"), datetime("now"))`,
          [
            receiveDate,
            safeCharges,
            customerName,
            currentToken,
            `Repair Charges received for ${currentToken} (${model || jobType})`,
            'Auto-recorded from Job Intake'
          ]
        );
      }

      toast.success(`Repair job ${currentToken} registered successfully!`);

      if (andPrint) {
        navigate(`/jobs/${newJobId}/print`);
      } else {
        navigate(`/jobs/${newJobId}`);
      }
    } catch (e: any) {
      console.error('Failed to create repair job:', e);
      toast.error(`Failed to save repair job: ${e?.message || 'Database error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Bulk / Market Supplier Laptops
  const handleBulkSubmit = async () => {
    if (!supplierName.trim()) {
      toast.error('Market Supplier / Dealer name is required!');
      return;
    }

    const validRows = bulkRows.filter((r) => r.model.trim() || r.symptoms.trim());
    if (validRows.length === 0) {
      toast.error('Please fill at least one laptop record with model and symptoms.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Get or create Supplier Customer ID
      let finalSupplierId = selectedSupplierId;
      if (!finalSupplierId) {
        const existingSupplier = await query<{ id: number }>(
          'SELECT id FROM customers WHERE (mobile = ? AND mobile != "") OR name = ? LIMIT 1',
          [supplierMobile, supplierName]
        );

        if (existingSupplier.length > 0) {
          finalSupplierId = existingSupplier[0].id;
        } else {
          await execute(
            'INSERT INTO customers (name, mobile, address, party_type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
            [supplierName, supplierMobile || '0300-SUPPLIER', supplierAddress || 'Market Dealer', 'supplier']
          );
          const newSuppRes = await query<{ id: number }>('SELECT last_insert_rowid() as id');
          finalSupplierId = newSuppRes[0].id;
        }
      }

      // 2. Fetch latest token baseline
      let baseTokenStr = await getNextPTSToken();
      let match = baseTokenStr.match(/^PTS-(\d+)$/i);
      let nextNum = match ? parseInt(match[1], 10) : 1;

      const createdTokens: string[] = [];

      // 3. Insert each laptop sequentially
      for (const row of validRows) {
        const token = `PTS-${nextNum.toString().padStart(3, '0')}`;
        nextNum++;
        createdTokens.push(token);

        const safeCharges = isNaN(Number(row.charges)) ? 0 : Number(row.charges);

        await execute(
          `INSERT INTO jobs (
            token_number, customer_id, job_type, serial_no, model, ram, hard, processor,
            symptoms, receive_date, return_date, charges, has_charger, payment_status, deliver_status, notes, created_at, updated_at
          ) VALUES (?, ?, 'laptop', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`,
          [
            token,
            finalSupplierId,
            row.serialNo || '',
            row.model || 'Market Laptop',
            row.ram || '',
            row.hard || '',
            row.processor || '',
            row.symptoms || 'Dealer checking',
            bulkReceiveDate,
            bulkReturnDate,
            safeCharges,
            row.hasCharger,
            row.paymentStatus,
            row.deliverStatus,
            `[Supplier Batch: ${supplierName}] ${row.notes || ''}`
          ]
        );
      }

      toast.success(
        `Successfully registered ${validRows.length} laptops from ${supplierName} (${createdTokens[0]} to ${
          createdTokens[createdTokens.length - 1]
        })!`
      );

      navigate('/jobs');
    } catch (e: any) {
      console.error('Failed to create bulk supplier jobs:', e);
      toast.error(`Bulk registration failed: ${e?.message || 'Database error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Bulk Row
  const addBulkRow = () => {
    setBulkRows([
      ...bulkRows,
      {
        id: `row-${Date.now()}`,
        model: '',
        serialNo: '',
        ram: '8GB DDR4',
        hard: '256GB SSD',
        processor: 'Core i5',
        symptoms: 'Board issue / checking',
        charges: 1500,
        hasCharger: 0,
        paymentStatus: 'due',
        deliverStatus: 'pending',
        notes: ''
      }
    ]);
  };

  const removeBulkRow = (id: string) => {
    if (bulkRows.length <= 1) return;
    setBulkRows(bulkRows.filter((r) => r.id !== id));
  };

  const updateBulkRow = (id: string, field: keyof BulkLaptopRow, value: any) => {
    setBulkRows(bulkRows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/jobs')}
            className="btn-ghost cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">
              New Repair Job Intake
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Register single repair tickets or batch intake multiple laptops from market suppliers
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setIntakeMode('single')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              intakeMode === 'single'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Single Customer Intake
          </button>

          <button
            type="button"
            onClick={() => setIntakeMode('bulk_supplier')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              intakeMode === 'bulk_supplier'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" /> Market Supplier Batch (Multi Laptops)
          </button>
        </div>
      </div>

      {/* MODE 1: SINGLE CUSTOMER INTAKE */}
      {intakeMode === 'single' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSingleSubmit(false);
          }}
          className="space-y-6"
        >
          {/* Token Display Bar */}
          <div className="bg-blue-50/80 dark:bg-blue-950/40 p-4 rounded-2xl border border-blue-200 dark:border-blue-800/60 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wide">
                  New Sequential Job Token:
                </span>
                <TokenDisplay token={tokenNumber} size="md" />
              </div>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                Auto-generated sequence starting with PTS-001
              </span>
            </div>

            {/* Reference Token Linking Display */}
            {referenceToken && (
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-700 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Linked Reference Token:
                  </span>
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-mono font-bold rounded">
                    {referenceToken}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    (Linked from client's repair history)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReferenceToken('')}
                  className="text-xs text-rose-500 hover:text-rose-700 font-bold"
                >
                  Remove Link
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Customer & Specs */}
            <div className="space-y-6">
              {/* Customer Section */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 font-heading">
                  Customer / Supplier Intake Selection
                </h2>
                <EnhancedCustomerSupplierSelect
                  selectedCustomerId={selectedCustomerId}
                  onSelectParty={(party, prevJobs) => {
                    if (party) {
                      setSelectedCustomerId(party.id);
                      setCustomerName(party.name);
                      setCustomerMobile(party.mobile || '');
                      setCustomerAddress(party.address || '');
                    } else {
                      setSelectedCustomerId(null);
                      setCustomerName('');
                      setCustomerMobile('');
                      setCustomerAddress('');
                      setReferenceToken('');
                    }
                  }}
                  onSelectReferenceJob={(job) => {
                    if (job) {
                      setReferenceToken(job.token_number);
                      if (!model) setModel(job.model || '');
                      if (!ram) setRam(job.ram || '');
                      if (!hard) setHard(job.hard || '');
                      if (!processor) setProcessor(job.processor || '');
                      toast.info(`Linked Reference Token ${job.token_number} (${job.model || job.job_type})`);
                    } else {
                      setReferenceToken('');
                    }
                  }}
                  label="Select Saved Customer or Supplier *"
                  showJobHistoryCard={true}
                />
              </div>

              {/* Device Hardware Specs */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 font-heading">
                    Device Hardware Specifications
                  </h2>

                  {/* Laptop vs PC Toggle */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setJobType('laptop')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        jobType === 'laptop'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Laptop className="w-3.5 h-3.5" /> Laptop
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobType('pc')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        jobType === 'pc'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" /> PC Desktop
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Brand & Model *
                    </label>
                    <input
                      type="text"
                      required
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. Dell XPS 15 9500 / HP Pavilion"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Serial / Tag Number
                    </label>
                    <input
                      type="text"
                      value={serialNo}
                      onChange={(e) => setSerialNo(e.target.value)}
                      placeholder="e.g. SN-893201"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      RAM Memory
                    </label>
                    <input
                      type="text"
                      value={ram}
                      onChange={(e) => setRam(e.target.value)}
                      placeholder="e.g. 8GB / 16GB DDR4"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Storage / SSD / HDD
                    </label>
                    <input
                      type="text"
                      value={hard}
                      onChange={(e) => setHard(e.target.value)}
                      placeholder="e.g. 512GB NVMe / 1TB HDD"
                      className="input-field"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Processor / CPU
                    </label>
                    <input
                      type="text"
                      value={processor}
                      onChange={(e) => setProcessor(e.target.value)}
                      placeholder="e.g. Intel Core i7 11th Gen / Ryzen 7"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Symptoms, Dates & Charges */}
            <div className="space-y-6">
              {/* Symptoms & Diagnosis */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 font-heading">
                  Symptoms & Problem Description
                </h2>
                <div>
                  <textarea
                    required
                    rows={4}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Describe reported fault e.g., No power, screen flickering, thermal overheating, OS boot loop..."
                    className="input-field"
                  />
                </div>
              </div>

              {/* Dates, Charges & Status */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 font-heading">
                  Dates, Charges & Status
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EnhancedDatePicker
                    label="Receive Date"
                    type="receive"
                    required
                    value={receiveDate}
                    onChange={(val) => setReceiveDate(val)}
                    helperText="Date brought into shop"
                  />

                  <EnhancedDatePicker
                    label="Expected Return Date"
                    type="return"
                    required
                    value={returnDate}
                    baseDate={receiveDate}
                    onChange={(val) => setReturnDate(val)}
                    minDate={receiveDate}
                    helperText="Target completion date"
                  />

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Repair Charges (PKR)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={charges}
                      onChange={(e) => setCharges(parseFloat(e.target.value) || 0)}
                      className="input-field font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Charger Included Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Charger / Adapter Included?
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setHasCharger(1)}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          hasCharger === 1
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Yes (Charger)
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasCharger(0)}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          hasCharger === 0
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {/* Payment Status Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Initial Payment Status
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setPaymentStatus('due')}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          paymentStatus === 'due'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        DUE
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentStatus('paid')}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          paymentStatus === 'paid'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        PAID
                      </button>
                    </div>
                  </div>

                  {/* Delivery Status Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Initial Delivery Status
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setDeliverStatus('pending')}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          deliverStatus === 'pending'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        PENDING
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliverStatus('delivered')}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          deliverStatus === 'delivered'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        DELIVERED
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSingleSubmit(true)}
              disabled={isSubmitting}
              className="btn-success cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Save & Print Ticket</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save Repair Job'}</span>
            </button>
          </div>
        </form>
      )}

      {/* MODE 2: MARKET SUPPLIER / BULK LAPTOPS INTAKE */}
      {intakeMode === 'bulk_supplier' && (
        <div className="space-y-6">
          {/* Supplier Info Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-heading">
                Market Supplier / Dealer Information & Intake History
              </h2>
            </div>

            <EnhancedCustomerSupplierSelect
              selectedCustomerId={selectedSupplierId}
              allowedType="all"
              onSelectParty={(party) => {
                if (party) {
                  setSelectedSupplierId(party.id);
                  setSupplierName(party.name);
                  setSupplierMobile(party.mobile || '');
                  setSupplierAddress(party.address || '');
                } else {
                  setSelectedSupplierId(null);
                  setSupplierName('');
                  setSupplierMobile('');
                  setSupplierAddress('');
                }
              }}
              label="Select Saved Dealer / Supplier *"
              showJobHistoryCard={true}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Receive Date
                </label>
                <input
                  type="date"
                  value={bulkReceiveDate}
                  onChange={(e) => setBulkReceiveDate(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Target Return Date
                </label>
                <input
                  type="date"
                  value={bulkReturnDate}
                  onChange={(e) => setBulkReturnDate(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex items-end">
                <div className="bg-indigo-50 dark:bg-indigo-950/50 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 w-full text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>Sequential Tokens will start from <strong>{tokenNumber}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Laptops Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-heading">
                  Supplier Laptops Intake List ({bulkRows.length} Laptops)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add multiple laptops received from this dealer in one batch
                </p>
              </div>

              <button
                type="button"
                onClick={addBulkRow}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Another Laptop</span>
              </button>
            </div>

            <div className="space-y-4">
              {bulkRows.map((row, idx) => (
                <div
                  key={row.id}
                  className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold">
                      Laptop #{idx + 1}
                    </span>

                    {bulkRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBulkRow(row.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Remove Laptop"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                        Laptop Model *
                      </label>
                      <input
                        type="text"
                        required
                        value={row.model}
                        onChange={(e) => updateBulkRow(row.id, 'model', e.target.value)}
                        placeholder="e.g. Lenovo ThinkPad T480"
                        className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                        Serial / Tag No
                      </label>
                      <input
                        type="text"
                        value={row.serialNo}
                        onChange={(e) => updateBulkRow(row.id, 'serialNo', e.target.value)}
                        placeholder="e.g. SN-5542"
                        className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                        Specs (RAM / SSD / CPU)
                      </label>
                      <input
                        type="text"
                        value={`${row.ram} / ${row.hard}`}
                        onChange={(e) => {
                          const parts = e.target.value.split('/');
                          updateBulkRow(row.id, 'ram', parts[0] || '');
                          if (parts[1]) updateBulkRow(row.id, 'hard', parts[1] || '');
                        }}
                        placeholder="8GB / 256GB SSD"
                        className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                        Est. Charges (PKR)
                      </label>
                      <input
                        type="number"
                        value={row.charges}
                        onChange={(e) => updateBulkRow(row.id, 'charges', parseFloat(e.target.value) || 0)}
                        placeholder="1500"
                        className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                        Fault / Symptoms *
                      </label>
                      <input
                        type="text"
                        required
                        value={row.symptoms}
                        onChange={(e) => updateBulkRow(row.id, 'symptoms', e.target.value)}
                        placeholder="e.g. Dead / No power on adapter, 3.3V missing"
                        className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                        Notes / Charger
                      </label>
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => updateBulkRow(row.id, 'notes', e.target.value)}
                        placeholder="e.g. No charger included, dealer urgently needs by Monday"
                        className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addBulkRow}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-dashed border-slate-300 dark:border-slate-700"
            >
              <Plus className="w-4 h-4 text-indigo-500" />
              <span>Add Another Laptop to this Supplier Batch</span>
            </button>
          </div>

          {/* Bulk Summary and Submit */}
          <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-600 dark:text-slate-400 space-x-4">
              <span>
                Total Laptops: <strong className="text-slate-900 dark:text-white font-bold">{bulkRows.length}</strong>
              </span>
              <span>
                Total Est. Charges:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {formatCurrency(bulkRows.reduce((acc, r) => acc + (Number(r.charges) || 0), 0))}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/jobs')}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={isSubmitting}
                className="btn-primary"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Registering...' : `Save All ${bulkRows.length} Laptops & Generate Tokens`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
