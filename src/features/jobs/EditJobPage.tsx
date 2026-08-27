import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Laptop,
  Monitor,
  Save,
  ArrowLeft,
  Trash2,
  UserCog
} from 'lucide-react';
import { toast } from 'sonner';
import { query, execute } from '../../lib/db';
import { Job, JobType, PaymentStatus, DeliverStatus } from '../../types/job';
import { TokenDisplay } from '../../components/shared/TokenDisplay';
import { EnhancedDatePicker } from '../../components/common/EnhancedDatePicker';
import { EnhancedCustomerSupplierSelect } from '../../components/shared/EnhancedCustomerSupplierSelect';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { DropdownSelect } from '../../components/ui/DropdownSelect';
import { ToggleGroup } from '../../components/ui/ToggleGroup';
import {
  RAM_OPTIONS,
  STORAGE_OPTIONS,
  PROCESSOR_OPTIONS,
} from '../../lib/constants';

interface CustomerRecord {
  id: number;
  name: string;
  mobile?: string;
  address?: string;
}

export const EditJobPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);

  // Party handling: null while untouched; edited via the shared party select.
  const [originalParty, setOriginalParty] = useState<CustomerRecord | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [reassignedTo, setReassignedTo] = useState<CustomerRecord | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setOriginalParty({
        id: j.customer_id,
        name: j.customer_name || '',
        mobile: j.customer_mobile || '',
        address: j.customer_address || ''
      });
      setSelectedCustomerId(j.customer_id);
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
      if (reassignedTo && reassignedTo.id !== originalParty?.id) {
        // Reassign the job to a different saved party without touching records.
        await execute(
          `UPDATE jobs SET customer_id = ?, updated_at = datetime('now') WHERE id = ?`,
          [reassignedTo.id, job.id]
        );
      } else {
        // Update contact info of the currently linked customer record.
        await execute(
          `UPDATE customers SET name = ?, mobile = ?, address = ?, updated_at = datetime('now') WHERE id = ?`,
          [customerName.trim() || originalParty?.name || '', customerMobile, customerAddress, job.customer_id]
        );
      }

      // Update job info
      await execute(
        `UPDATE jobs SET
          job_type = ?, serial_no = ?, model = ?, ram = ?, hard = ?, processor = ?,
          symptoms = ?, receive_date = ?, return_date = ?, charges = ?, has_charger = ?,
          payment_status = ?, deliver_status = ?, notes = ?, updated_at = datetime('now')
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/jobs/${job.id}`)}
            aria-label="Back to job"
            className="btn-ghost"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">Edit Repair Record</h1>
            <p className="page-subtitle">Update hardware specifications, charges, or status for {job.token_number}</p>
          </div>
        </div>

        <TokenDisplay token={job.token_number} size="lg" />
      </div>

      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer & Specs */}
          <div className="space-y-6">
            <div className="card-container space-y-4">
              <h2 className="section-title border-b border-slate-100 dark:border-slate-800 pb-2">
                Customer Details
              </h2>

              {reassignedTo && reassignedTo.id !== originalParty?.id ? (
                <div className="flex items-start justify-between gap-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <UserCog className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700 dark:text-blue-400 leading-snug min-w-0">
                      On save, this job will be reassigned to{' '}
                      <strong>{reassignedTo.name}</strong> ({reassignedTo.mobile || 'no phone'}).
                      Contact details below no longer apply.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReassignedTo(null);
                      setSelectedCustomerId(originalParty?.id ?? null);
                    }}
                    className="text-xs font-bold text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer"
                  >
                    Undo
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    type="text"
                    required
                    label="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <Input
                    type="tel"
                    required
                    label="Mobile Phone"
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value)}
                    placeholder="03XX-XXXXXXX"
                  />
                  <Input
                    type="text"
                    label="Address / City"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <EnhancedCustomerSupplierSelect
                  selectedCustomerId={selectedCustomerId}
                  allowedType="all"
                  onSelectParty={(party) => {
                    if (party) {
                      setSelectedCustomerId(party.id);
                      setReassignedTo({ id: party.id, name: party.name, mobile: party.mobile || '', address: party.address || '' });
                    } else {
                      // Cleared back to the original record holder.
                      setReassignedTo(null);
                      setSelectedCustomerId(originalParty?.id ?? null);
                    }
                  }}
                  label={`Reassign to Another Saved Customer / Supplier (currently: ${originalParty?.name || 'unknown'})`}
                  showJobHistoryCard={false}
                />
              </div>
            </div>

            <div className="card-container space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                <h2 className="section-title shrink-0">
                  Device Hardware Specs
                </h2>
                <ToggleGroup
                  value={jobType}
                  onChange={(v) => setJobType(v as JobType)}
                  options={[
                    { value: 'laptop', label: 'Laptop', icon: <Laptop className="w-3.5 h-3.5" /> },
                    { value: 'pc', label: 'PC Desktop', icon: <Monitor className="w-3.5 h-3.5" /> },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  type="text"
                  label="Model Name"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. Dell XPS 15 9500"
                />
                <Input
                  type="text"
                  label="Serial Number"
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  placeholder="e.g. SN-893201"
                />

                <DropdownSelect
                  label="RAM Memory"
                  options={RAM_OPTIONS}
                  value={ram}
                  onChange={setRam}
                  allowCustom
                  placeholder="Select RAM…"
                />

                <DropdownSelect
                  label="Hard Drive / SSD"
                  options={STORAGE_OPTIONS}
                  value={hard}
                  onChange={setHard}
                  allowCustom
                  placeholder="Select storage…"
                />

                <div className="sm:col-span-2">
                  <DropdownSelect
                    label="Processor / CPU"
                    options={PROCESSOR_OPTIONS}
                    value={processor}
                    onChange={setProcessor}
                    searchable
                    allowCustom
                    placeholder="Select processor…"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Symptoms, Dates & Charges */}
          <div className="space-y-6">
            <div className="card-container space-y-4">
              <h2 className="section-title border-b border-slate-100 dark:border-slate-800 pb-2">
                Symptoms & Problem Description
              </h2>
              <Textarea
                rows={4}
                required
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Describe reported fault…"
              />
            </div>

            <div className="card-container space-y-4">
              <h2 className="section-title border-b border-slate-100 dark:border-slate-800 pb-2">
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

                <Input
                  type="number"
                  min={0}
                  label="Repair Charges (PKR)"
                  value={charges}
                  onChange={(e) => setCharges(parseFloat(e.target.value) || 0)}
                  className="[&_input]:font-bold [&_input]:text-slate-900 dark:[&_input]:text-white"
                />

                <div className="sm:col-span-2">
                  <label className="form-label">
                    Payment Status
                  </label>
                  <div className="pt-1">
                    <ToggleGroup
                      columns={3}
                      variant="cards"
                      value={paymentStatus}
                      onChange={(v) => setPaymentStatus(v as PaymentStatus)}
                      options={[
                        { value: 'due', label: 'DUE', tone: 'danger' },
                        { value: 'paid', label: 'PAID', tone: 'success' },
                        { value: 'complimentary', label: 'NO PAYMENT', tone: 'violet' },
                      ]}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="form-label">
                    Delivery Status
                  </label>
                  <div className="pt-1">
                    <ToggleGroup
                      columns={5}
                      variant="cards"
                      value={deliverStatus}
                      onChange={(v) => setDeliverStatus(v as DeliverStatus)}
                      options={[
                        { value: 'pending', label: 'Pending', tone: 'neutral' },
                        { value: 'in_progress', label: 'In Progress', tone: 'info' },
                        { value: 'in_diagnostics', label: 'Diagnostics', tone: 'violet' },
                        { value: 'ready', label: 'Ready', tone: 'warning' },
                        { value: 'delivered', label: 'Delivered', tone: 'success' },
                      ]}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <Input
                    type="text"
                    label="Internal Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Technician remarks, promised parts, etc."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button size="lg" variant="secondary" onClick={() => navigate(`/jobs/${job.id}`)}>
            Cancel
          </Button>
          <Button size="lg" type="submit" icon={<Save className="w-4 h-4" />}>
            Update Job Record
          </Button>
        </div>
      </form>
    </div>
  );
};
