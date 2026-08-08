import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
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
  Plug
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../../store/settings';
import { CustomerAutocomplete } from '../../components/shared/CustomerAutocomplete';
import { EnhancedDatePicker } from '../../components/common/EnhancedDatePicker';
import { query, execute } from '../../lib/db';
import { JobType, PaymentStatus, DeliverStatus } from '../../types/job';
import { TokenDisplay } from '../../components/shared/TokenDisplay';

export const AddJobPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, getNextTokenNumber } = useSettingsStore();

  const [tokenNumber, setTokenNumber] = useState<string>('TK-1000');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  // Customer state
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // Device specs
  const [jobType, setJobType] = useState<JobType>('laptop');
  const [model, setModel] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [ram, setRam] = useState('');
  const [hard, setHard] = useState('');
  const [processor, setProcessor] = useState('');
  const [symptoms, setSymptoms] = useState('');

  // Dates & charges
  const [receiveDate, setReceiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState<string>(
    new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
  );
  const [charges, setCharges] = useState<number>(parseInt(settings.default_charges || '1500', 10));
  const [hasCharger, setHasCharger] = useState<number>(1); // 1 = Yes, 0 = No
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('due');
  const [deliverStatus, setDeliverStatus] = useState<DeliverStatus>('pending');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Generate fresh token
    getNextTokenNumber().then(setTokenNumber);
  }, []);

  const handleSubmit = async (andPrint: boolean = false) => {
    if (!customerName.trim() || !customerMobile.trim()) {
      toast.error('Customer name and mobile number are required!');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalCustomerId = selectedCustomerId;

      // 1. Save or update customer record if new
      if (!finalCustomerId) {
        const existingCust = await query<{ id: number }>(
          'SELECT id FROM customers WHERE mobile = ? OR name = ? LIMIT 1',
          [customerMobile, customerName]
        );

        if (existingCust.length > 0) {
          finalCustomerId = existingCust[0].id;
        } else {
          await execute(
            `INSERT INTO customers (name, mobile, address, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
            [customerName, customerMobile, customerAddress]
          );
          const newCustRes = await query<{ id: number }>('SELECT last_insert_rowid() as id');
          finalCustomerId = newCustRes[0].id;
        }
      }

      // 2. Insert Job record
      await execute(
        `INSERT INTO jobs (
          token_number, customer_id, job_type, serial_no, model, ram, hard, processor,
          symptoms, receive_date, return_date, charges, has_charger, payment_status, deliver_status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          tokenNumber,
          finalCustomerId,
          jobType,
          serialNo,
          model,
          ram,
          hard,
          processor,
          symptoms,
          receiveDate,
          returnDate,
          charges,
          hasCharger,
          paymentStatus,
          deliverStatus,
          notes
        ]
      );

      const jobRes = await query<{ id: number }>('SELECT last_insert_rowid() as id');
      const newJobId = jobRes[0].id;

      toast.success(`Repair job ${tokenNumber} registered successfully!`);

      if (andPrint) {
        navigate(`/jobs/${newJobId}/print`);
      } else {
        navigate(`/jobs/${newJobId}`);
      }
    } catch (e) {
      console.error('Failed to create repair job:', e);
      toast.error('Failed to save repair job.');
    } finally {
      setIsSubmitting(false);
    }
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
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">New Repair Job Intake</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Fill in customer and device specifications to generate a repair token</p>
          </div>
        </div>

        {/* Auto Token Display */}
        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800/60">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">Token ID:</span>
          <TokenDisplay token={tokenNumber} size="md" />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(false);
        }}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Customer & Specs */}
          <div className="space-y-6">
            {/* Customer Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 font-heading">
                Customer Information
              </h2>
              <CustomerAutocomplete
                onSelectCustomer={(cust) => {
                  if (cust) {
                    setSelectedCustomerId(cust.id);
                    setCustomerName(cust.name);
                    setCustomerMobile(cust.mobile);
                    setCustomerAddress(cust.address);
                  }
                }}
                onCustomerDetailsChange={(n, m, a) => {
                  setCustomerName(n);
                  setCustomerMobile(m);
                  setCustomerAddress(a);
                }}
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
                    Brand & Model
                  </label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Dell XPS 15 9500 / HP Pavilion"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
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
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
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
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
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
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
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
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
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
                  className="w-full p-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>
            </div>

            {/* Dates, Charges & Accessories */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 font-heading">
                Dates, Charges & Status
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <EnhancedDatePicker
                  label="Receive Date"
                  type="receive"
                  required
                  value={receiveDate}
                  onChange={(val) => setReceiveDate(val)}
                  helperText="Date when hardware was brought into shop"
                />

                <EnhancedDatePicker
                  label="Expected Return Date"
                  type="return"
                  required
                  value={returnDate}
                  baseDate={receiveDate}
                  onChange={(val) => setReturnDate(val)}
                  minDate={receiveDate}
                  helperText="Target completion or customer pickup date"
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
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white"
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
            onClick={() => handleSubmit(true)}
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
            <span>Save Repair Job</span>
          </button>
        </div>
      </form>
    </motion.div>
  );
};

