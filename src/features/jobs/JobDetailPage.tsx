import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Edit2,
  Printer,
  MessageSquare,
  Trash2,
  User,
  Phone,
  MapPin,
  Laptop,
  Monitor,
  Calendar,
  DollarSign,
  Tag,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  Cpu,
  HardDrive,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { query, execute } from '../../lib/db';
import { Job } from '../../types/job';
import { formatCurrency, formatDate, isOverdue } from '../../lib/utils';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { TokenDisplay } from '../../components/shared/TokenDisplay';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { useSettingsStore } from '../../store/settings';
import { generateWhatsAppMessage, openWhatsAppDeeplink } from '../../lib/whatsapp';
import { JobProgressTracker } from '../../components/shared/JobProgressTracker';

export const JobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettingsStore();

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyTemplate, setNotifyTemplate] = useState<'ready' | 'update' | 'payment_reminder'>('ready');

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
      setJob(res[0]);
    } catch (e) {
      console.error('Failed to load job details:', e);
      toast.error('Failed to load repair record.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePayment = async () => {
    if (!job) return;
    const newStatus = job.payment_status === 'paid' ? 'due' : 'paid';
    await execute(`UPDATE jobs SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`, [
      newStatus,
      job.id
    ]);
    toast.success(`Payment status updated to ${newStatus.toUpperCase()}`);
    loadJob(job.id);
  };

  const handleToggleDelivery = async () => {
    if (!job) return;
    const newStatus = job.deliver_status === 'delivered' ? 'pending' : 'delivered';
    await execute(`UPDATE jobs SET deliver_status = ?, updated_at = datetime('now') WHERE id = ?`, [
      newStatus,
      job.id
    ]);
    toast.success(`Delivery status updated to ${newStatus.toUpperCase()}`);
    loadJob(job.id);
  };

  const handleDeleteJob = async () => {
    if (!job) return;
    if (confirm(`Are you sure you want to soft-delete repair record ${job.token_number}?`)) {
      await execute(`UPDATE jobs SET deleted_at = datetime('now') WHERE id = ?`, [job.id]);
      toast.success('Job record deleted.');
      navigate('/jobs');
    }
  };

  const handleSendWhatsApp = () => {
    if (!job || !job.customer_mobile) {
      toast.error('Customer mobile phone is missing.');
      return;
    }
    const message = generateWhatsAppMessage(
      notifyTemplate,
      job,
      settings.shop_name,
      settings.shop_mobile
    );
    openWhatsAppDeeplink(job.customer_mobile, message);
    setShowNotifyModal(false);

    // Log notification
    execute(
      `INSERT INTO job_notifications (job_id, channel, message, sent_at, status) VALUES (?, 'whatsapp', ?, datetime('now'), 'sent')`,
      [job.id, message]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading || !job) {
    return <div className="py-20 text-center text-slate-400">Loading repair job details...</div>;
  }

  const overdue = isOverdue(job.return_date, job.deliver_status);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/jobs')}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {job.model || `${job.job_type.toUpperCase()} System`}
              </h1>
              <TokenDisplay token={job.token_number} size="md" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer: <span className="font-semibold text-slate-700 dark:text-slate-300">{job.customer_name}</span> • Phone: {job.customer_mobile}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotifyModal(true)}
            className="btn-success"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Notify WhatsApp</span>
          </button>

          <button
            onClick={handlePrint}
            className="btn-primary"
            title="Trigger direct window print for receipt"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>

          <button
            onClick={() => navigate(`/jobs/${job.id}/print`)}
            className="btn-secondary"
            title="Thermal & Custom Format Options"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Thermal / A4</span>
          </button>

          <button
            onClick={() => navigate(`/jobs/${job.id}/edit`)}
            className="btn-secondary p-2"
            title="Edit Record"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteJob}
            className="btn-danger p-2"
            title="Delete Record"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Progress Lifecycle Indicator */}
          <JobProgressTracker
            job={job}
            onToggleDelivery={handleToggleDelivery}
            onOpenNotify={() => setShowNotifyModal(true)}
          />

          {/* Status Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Status</span>
                <button onClick={handleTogglePayment} title="Click to toggle Paid/Due">
                  <StatusBadge type="payment" status={job.payment_status} size="lg" />
                </button>
              </div>

              <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Status</span>
                <button onClick={handleToggleDelivery} title="Click to toggle Delivery">
                  {overdue ? (
                    <StatusBadge type="overdue" size="lg" />
                  ) : (
                    <StatusBadge type="deliver" status={job.deliver_status} size="lg" />
                  )}
                </button>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Charges</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(job.charges)}</span>
            </div>
          </div>

          {/* Fault & Symptoms */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reported Symptoms & Issues</h3>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-slate-100 text-sm font-medium leading-relaxed">
              {job.symptoms || 'No specific fault described at intake.'}
            </div>
          </div>

          {/* Hardware Specs Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
              Device Specifications
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Device Type</span>
                <span className="font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5 mt-0.5">
                  {job.job_type === 'laptop' ? <Laptop className="w-4 h-4 text-blue-500" /> : <Monitor className="w-4 h-4 text-indigo-500" />}
                  {job.job_type}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">Model</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">{job.model || 'N/A'}</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">Serial Number</span>
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-0.5 block">{job.serial_no || 'N/A'}</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">RAM</span>
                <span className="font-medium text-slate-900 dark:text-white mt-0.5 block">{job.ram || 'N/A'}</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">Storage / Disk</span>
                <span className="font-medium text-slate-900 dark:text-white mt-0.5 block">{job.hard || 'N/A'}</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">Processor</span>
                <span className="font-medium text-slate-900 dark:text-white mt-0.5 block">{job.processor || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Customer & Print QR */}
        <div className="space-y-6">
          {/* Customer Profile Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
              Customer Contact
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-lg">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{job.customer_name}</p>
                  <p className="text-xs text-slate-400">Customer Name</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{job.customer_mobile}</p>
                  <p className="text-xs text-slate-400">Mobile Number</p>
                </div>
              </div>

              {job.customer_address && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-lg">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white">{job.customer_address}</p>
                    <p className="text-xs text-slate-400">Address / City</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Key Dates & Accessories */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
              Intake & Return Info
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Received Date:</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatDate(job.receive_date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Expected Return:</span>
                <span className={`font-bold ${overdue ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                  {formatDate(job.return_date)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Charger / Adapter:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${job.has_charger ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                  {job.has_charger ? 'YES (INCLUDED)' : 'NO CHARGER'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick QR Code Display */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs text-center space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Repair Token QR Code</h3>
            <div className="flex justify-center">
              <QRCodeDisplay value={job.token_number} size={110} />
            </div>
            <p className="text-[11px] text-slate-400">Scan QR to lookup repair job instantly</p>
          </div>
        </div>
      </div>

      {/* Hidden Printable Receipt for Customer (Triggered via window.print()) */}
      <div id="printable-content" className="hidden print:block font-sans text-slate-900 bg-white p-6 max-w-2xl mx-auto border border-slate-300">
        {/* Receipt Header */}
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-4">
          <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900">
            {settings.shop_name || 'ProData Repair Center'}
          </h2>
          <p className="text-xs text-slate-600 font-medium">{settings.shop_address}</p>
          <p className="text-xs font-bold text-slate-800">Contact / Helpline: {settings.shop_mobile}</p>
          <div className="mt-2 inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] font-black uppercase tracking-wider">
            Official Customer Repair Receipt & Intake Slip
          </div>
        </div>

        {/* Token Number & Date Banner */}
        <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-300 mb-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Repair Token #</span>
            <span className="text-2xl font-black font-mono text-slate-900 tracking-wider">{job.token_number}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Date Issued</span>
            <span className="text-xs font-bold text-slate-900">{formatDate(job.receive_date)}</span>
          </div>
        </div>

        {/* Customer & Device Information */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
          <div className="border border-slate-200 p-3 rounded-lg bg-slate-50">
            <h4 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2 uppercase text-[10px] tracking-wider">Customer Details</h4>
            <p className="font-bold text-slate-900">{job.customer_name}</p>
            <p className="text-slate-700">Phone: <span className="font-mono">{job.customer_mobile}</span></p>
            {job.customer_address && <p className="text-slate-600 text-[11px]">Address: {job.customer_address}</p>}
          </div>

          <div className="border border-slate-200 p-3 rounded-lg bg-slate-50">
            <h4 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2 uppercase text-[10px] tracking-wider">Device Specs</h4>
            <p className="font-bold text-slate-900">{job.job_type.toUpperCase()} - {job.model || 'Standard Model'}</p>
            <p className="text-slate-700">S/N: <span className="font-mono font-semibold">{job.serial_no || 'N/A'}</span></p>
            <p className="text-slate-600 text-[11px]">Specs: {job.processor || '-'} | {job.ram || '-'} | {job.hard || '-'}</p>
            <p className="text-slate-700 font-semibold mt-1">Charger Included: {job.has_charger ? 'YES ✓' : 'NO ✗'}</p>
          </div>
        </div>

        {/* Symptoms / Reported Issues */}
        <div className="border border-slate-300 p-3 rounded-lg mb-4 text-xs">
          <span className="font-bold uppercase text-[10px] text-slate-500 block mb-1">Reported Fault / Symptoms:</span>
          <p className="font-medium text-slate-900 italic">{job.symptoms || 'General diagnostic inspection & repair service.'}</p>
        </div>

        {/* Charges & Payment Details */}
        <div className="border-t-2 border-b-2 border-slate-900 py-3 mb-4 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold uppercase text-[10px] text-slate-500 block">Expected Return Date</span>
            <span className="font-bold text-slate-900">{formatDate(job.return_date)}</span>
          </div>
          <div>
            <span className="font-bold uppercase text-[10px] text-slate-500 block">Status</span>
            <span className="font-bold text-slate-900 uppercase">PAYMENT: {job.payment_status} | DELIVERY: {job.deliver_status}</span>
          </div>
          <div className="text-right">
            <span className="font-bold uppercase text-[10px] text-slate-500 block">Repair Charge Amount</span>
            <span className="text-lg font-black text-slate-900 font-mono">{formatCurrency(job.charges)}</span>
          </div>
        </div>

        {/* Terms & QR Footer */}
        <div className="flex items-center justify-between gap-4 pt-2 text-[10px] text-slate-600">
          <div className="flex-1 space-y-0.5">
            <p className="font-bold text-slate-800 uppercase">Terms & Conditions:</p>
            <p>1. Please present this original receipt when collecting your device.</p>
            <p>2. We are not liable for unbacked data loss during diagnostics/repair.</p>
            <p>3. Unclaimed hardware after 30 days of completion may incur storage charges.</p>
          </div>
          <div className="flex flex-col items-center">
            <QRCodeDisplay value={job.token_number} size={65} />
            <span className="font-mono text-[9px] text-slate-500 mt-1">{job.token_number}</span>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-6 pt-4 border-t border-dashed border-slate-300 text-[10px] text-slate-500">
          <div>
            <div className="h-8 border-b border-slate-400 mb-1"></div>
            <p className="text-center font-semibold">Customer Signature</p>
          </div>
          <div>
            <div className="h-8 border-b border-slate-400 mb-1"></div>
            <p className="text-center font-semibold">Technician / Store Stamp</p>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <AnimatePresence>
        {showNotifyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNotifyModal(false)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">Notify Customer via WhatsApp</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Select pre-built message template to send to {job.customer_mobile}:</p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setNotifyTemplate('ready')}
                  className={`w-full p-3.5 rounded-xl border text-left text-xs font-semibold transition-colors cursor-pointer ${
                    notifyTemplate === 'ready'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  1. "Ready for Collection"
                  <p className="text-[10px] text-slate-400 font-normal mt-0.5">Informs customer repair is completed and ready.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setNotifyTemplate('update')}
                  className={`w-full p-3.5 rounded-xl border text-left text-xs font-semibold transition-colors cursor-pointer ${
                    notifyTemplate === 'update'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  2. "Technician Inspection Update"
                  <p className="text-[10px] text-slate-400 font-normal mt-0.5">Sends status update with symptoms & return date.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setNotifyTemplate('payment_reminder')}
                  className={`w-full p-3.5 rounded-xl border text-left text-xs font-semibold transition-colors cursor-pointer ${
                    notifyTemplate === 'payment_reminder'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  3. "Payment Outstanding Reminder"
                  <p className="text-[10px] text-slate-400 font-normal mt-0.5">Reminds customer regarding unpaid repair charges.</p>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowNotifyModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendWhatsApp}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Open WhatsApp Web/App →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
