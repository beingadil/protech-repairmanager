import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Laptop,
  Monitor,
  Save,
  ArrowLeft,
  Printer,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { query, execute } from '../../lib/db';
import { Job, JobType, PaymentStatus, DeliverStatus } from '../../types/job';
import { TokenDisplay } from '../../components/shared/TokenDisplay';
import { EnhancedDatePicker } from '../../components/common/EnhancedDatePicker';

export const EditJobPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);

  // Form states
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

  const [receiveDate, setReceiveDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [charges, setCharges] = useState<number>(0);
  const [hasCharger, setHasCharger] = useState<number>(1);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('due');
  const [deliverStatus, setDeliverStatus] = useState<DeliverStatus>('pending');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (id) loadJob(parseInt(id, 10));
  }, [id]);

  const loadJob = async (jobId: number) => {
    setIsLoading(true);
    try {
      const res = await query<Job>(
        `SELECT j.*, c.name as customer_name, c.mobile as customer_mobile, c.address as customer_address
         FROM jobs j
         JOIN customers c ON j.customer_id = c.id
         WHERE j.id = ? AND j.deleted_at IS NULL LIMIT 1`,
        [jobId]
      );

      if (res.length === 0) {
        toast.error('Repair job record not found.');
        navigate('/jobs');
        return;
      }

      const j = res[0];
      setJob(j);
      setCustomerName(j.customer_name || '');
      setCustomerMobile(j.customer_mobile || '');
      setCustomerAddress(j.customer_address || '');

      setJobType(j.job_type);
      setModel(j.model || '');
      setSerialNo(j.serial_no || '');
      setRam(j.ram || '');
      setHard(j.hard || '');
      setProcessor(j.processor || '');
      setSymptoms(j.symptoms || '');

      setReceiveDate(j.receive_date || '');
      setReturnDate(j.return_date || '');
      setCharges(j.charges || 0);
      setHasCharger(j.has_charger || 0);
      setPaymentStatus(j.payment_status);
      setDeliverStatus(j.deliver_status);
      setNotes(j.notes || '');
    } catch (e) {
      console.error('Failed to load job for editing:', e);
      toast.error('Failed to load repair record.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    try {
      // Update customer info
      await execute('UPDATE customers SET name = ?, mobile = ?, address = ?, updated_at = datetime("now") WHERE id = ?', [
        customerName,
        customerMobile,
        customerAddress,
        job.customer_id
      ]);

      // Update job info
      await execute(
        `UPDATE jobs SET
          job_type = ?, serial_no = ?, model = ?, ram = ?, hard = ?, processor = ?,
          symptoms = ?, receive_date = ?, return_date = ?, charges = ?, has_charger = ?,
          payment_status = ?, deliver_status = ?, notes = ?, updated_at = datetime("now")
         WHERE id = ?`,
        [
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
          notes,
          job.id
        ]
      );

      toast.success(`Job ${job.token_number} updated successfully.`);
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      console.error('Failed to update job:', err);
      toast.error('Failed to update repair record.');
    }
  };

  if (isLoading || !job) {
    return <div className="py-20 text-center text-slate-400">Loading repair job details...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/jobs/${job.id}`)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Edit Repair Record</h1>
            <p className="text-xs text-slate-500">Update hardware specifications, charges, or status for {job.token_number}</p>
          </div>
        </div>

        <TokenDisplay token={job.token_number} size="lg" />
      </div>

      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer & Specs */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                Customer Details
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Address / City
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Device Hardware Specs
                </h2>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setJobType('laptop')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                      jobType === 'laptop' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" /> Laptop
                  </button>
                  <button
                    type="button"
                    onClick={() => setJobType('pc')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                      jobType === 'pc' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" /> PC
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={serialNo}
                    onChange={(e) => setSerialNo(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
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
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Hard Drive / SSD
                  </label>
                  <input
                    type="text"
                    value={hard}
                    onChange={(e) => setHard(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Symptoms, Dates & Charges */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                Symptoms & Problem Description
              </h2>
              <textarea
                rows={4}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="w-full p-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                Charges & Repair Status
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <EnhancedDatePicker
                  label="Receive Date"
                  type="receive"
                  value={receiveDate}
                  onChange={(val) => setReceiveDate(val)}
                  helperText="Initial hardware intake date"
                />

                <EnhancedDatePicker
                  label="Return Date"
                  type="return"
                  value={returnDate}
                  baseDate={receiveDate}
                  onChange={(val) => setReturnDate(val)}
                  minDate={receiveDate}
                  helperText="Target completion or collection date"
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Repair Charges (PKR)
                  </label>
                  <input
                    type="number"
                    value={charges}
                    onChange={(e) => setCharges(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Payment Status
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPaymentStatus('due')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border ${
                        paymentStatus === 'due' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      DUE
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentStatus('paid')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border ${
                        paymentStatus === 'paid' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      PAID
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Delivery Status
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setDeliverStatus('pending')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border ${
                        deliverStatus === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      PENDING
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliverStatus('delivered')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border ${
                        deliverStatus === 'delivered' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
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

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => navigate(`/jobs/${job.id}`)}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-md"
          >
            <Save className="w-4 h-4" />
            <span>Update Job Record</span>
          </button>
        </div>
      </form>
    </div>
  );
};
