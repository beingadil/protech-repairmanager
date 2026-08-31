import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DropdownSelect } from '../../components/ui/DropdownSelect';
import { ToggleGroup } from '../../components/ui/ToggleGroup';
import { EnhancedDatePicker } from '../../components/common/EnhancedDatePicker';
import { MoneyText } from '../../components/ui/MoneyText';
import { Account } from '../../types/finance';
import { postVoucher } from '../../lib/finance';
import { query } from '../../lib/db';
import { Job } from '../../types/job';
import { formatCurrency } from '../../lib/utils';
import { CATEGORY_PRESETS } from './hooks/useFinanceData';

interface VoucherFormProps {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
  accounts: Account[];
  paymentAccounts: Account[];
  /** Pre-filled flow ('receipt' = money in). */
  initialFlow?: 'receipt' | 'payment';
  /** Optional prefilled job — opens in job-payment mode. */
  presetJob?: Job | null;
}

interface JobBalanceInfo {
  job: Job;
  paid: number;
  net: number;
  balance: number;
}

async function resolveJobBalance(token: string): Promise<JobBalanceInfo | null> {
  const t = token.trim();
  if (!t) return null;
  const jobs = await query<Job>(
    `SELECT j.*, c.name as customer_name FROM jobs j
     JOIN customers c ON j.customer_id = c.id
     WHERE j.token_number = ? AND j.deleted_at IS NULL LIMIT 1`,
    [t]
  );
  if (jobs.length === 0) return null;
  const job = jobs[0];
  const paidRows = await query<{ c: number }>(
    "SELECT COALESCE(SUM(amount), 0) as c FROM financial_transactions WHERE type = 'credit' AND token_number = ?",
    [t]
  );
  const paid = paidRows[0] ? Number(paidRows[0].c) || 0 : 0;
  const charges = Math.max(0, Number(job.charges) || 0);
  const discount = Math.min(charges, Math.max(0, Number(job.discount) || 0));
  const net = charges - discount;
  return { job, paid, net, balance: Math.max(0, net - paid) };
}

/**
 * Single balanced voucher entry — the refactored "New Voucher" modal.
 * All money math flows through lib/finance.ts postVoucher(); this form only
 * collects input and computes the job balance preview.
 */
export const VoucherForm: React.FC<VoucherFormProps> = ({
  open,
  onClose,
  onPosted,
  accounts,
  paymentAccounts,
  initialFlow = 'receipt',
  presetJob
}) => {
  const [flow, setFlow] = useState<'receipt' | 'payment'>(initialFlow);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [categoryCode, setCategoryCode] = useState(3000);
  const [payAccountCode, setPayAccountCode] = useState(1000);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [partyName, setPartyName] = useState('');
  const [partyOptions, setPartyOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [partySupplierName, setPartySupplierName] = useState('');
  const [token, setToken] = useState('');
  const [jobInfo, setJobInfo] = useState<JobBalanceInfo | null>(null);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset on open; prefill from preset job when provided (JobDetail entry point)
  useEffect(() => {
    if (!open) return;
    setFlow(initialFlow);
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setCategoryCode(initialFlow === 'receipt' ? 3000 : 4010);
    setPayAccountCode(1000);
    setPartySupplierName('');
    setPartyName('');
    setToken('');
    setJobInfo(null);
    setDescription('');
    setNotes('');
    setPartyId(null);
    query<{ id: number; name: string }>('SELECT id, name FROM customers ORDER BY name ASC')
      .then(setPartyOptions)
      .catch(() => {});
    if (presetJob) {
      setToken(presetJob.token_number);
      setPartyId(presetJob.customer_id);
      if (presetJob.customer_name) setPartyName(presetJob.customer_name);
      const charges = Math.max(0, Number(presetJob.charges) || 0);
      const discount = Math.min(charges, Math.max(0, Number(presetJob.discount) || 0));
      const net = charges - discount;
      setDescription(`Repair charges for ${presetJob.token_number} (${presetJob.model || presetJob.job_type})`);
      (async () => {
        const info = await resolveJobBalance(presetJob.token_number);
        if (info) {
          setJobInfo(info);
          if (info.balance > 0) setAmount(String(info.balance));
        } else {
          const paidRows = await query<{ c: number }>(
            "SELECT COALESCE(SUM(amount), 0) as c FROM financial_transactions WHERE type = 'credit' AND token_number = ?",
            [presetJob.token_number]
          );
          const paid = paidRows[0] ? Number(paidRows[0].c) || 0 : 0;
          setJobInfo({
            job: presetJob,
            paid,
            net,
            balance: Math.max(0, net - paid)
          });
          if (net - paid > 0) setAmount(String(net - paid));
        }
      })();
    }
  }, [open, initialFlow, presetJob]);

  // Token → job balance resolution
  const handleTokenChange = async (t: string) => {
    setToken(t);
    if (!t.trim()) {
      setJobInfo(null);
      return;
    }
    const info = await resolveJobBalance(t);
    setJobInfo(info);
    if (info) {
      setPartyId(info.job.customer_id);
      if (info.balance > 0) setAmount(String(info.balance));
      if (!description) {
        setDescription(
          `Repair charges for ${info.job.token_number} (${info.job.model || info.job.job_type})`
        );
      }
    }
  };

  const categories = useMemo(
    () => CATEGORY_PRESETS.filter((c) => c.flow === (flow === 'receipt' ? 'in' : 'out')),
    [flow]
  );

  const amountNum = Math.max(0, parseFloat(amount) || 0);
  const isReceipt = flow === 'receipt';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountNum <= 0) {
      toast.error('Please enter a valid amount greater than 0.');
      return;
    }
    if (!description.trim()) {
      toast.error('Please enter a description for this voucher.');
      return;
    }
    if (!isReceipt && !partyId && !partySupplierName.trim()) {
      toast.error('Select or name the payee (supplier) for this payment.');
      return;
    }
    // Job-linked receipts cannot exceed the balance due (accounting integrity).
    if (isReceipt && jobInfo) {
      if (jobInfo.job.payment_status === 'complimentary') {
        toast.error('This job is COMPLIMENTARY — no payment required.');
        return;
      }
      if (amountNum > jobInfo.balance) {
        toast.error(
          `Payment of ${formatCurrency(amountNum)} exceeds the balance due (${formatCurrency(jobInfo.balance)}).`
        );
        return;
      }
    }

    let partyNameForSupplier: string | null = null;
    if (!isReceipt && !partyId && partySupplierName.trim()) {
      partyNameForSupplier = partySupplierName.trim();
    }

    setIsSubmitting(true);
    try {
      const voucherNo = await postVoucher({
        date,
        type: flow,
        amount: amountNum,
        categoryAccountCode: categoryCode,
        paymentAccountCode: payAccountCode,
        partyCustomerId: partyId,
        partySupplierName: partyNameForSupplier,
        referenceToken: token.trim() || null,
        description: description.trim(),
        notes: notes.trim() || null
      });
      toast.success(
        `${isReceipt ? 'Receipt' : 'Payment'} ${voucherNo} of ${formatCurrency(amountNum)} recorded.`
      );
      onPosted();
      onClose();
    } catch (err: any) {
      console.error('Failed to post voucher:', err);
      toast.error(err?.message || 'Failed to record the voucher.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Voucher"
      subtitle="Balanced entry — money in or money out"
      size="md"
    >
      <form onSubmit={submit} className="space-y-4">
        <ToggleGroup
          columns={2}
          variant="cards"
          value={flow}
          onChange={(v) => {
            const next = v as 'receipt' | 'payment';
            setFlow(next);
            setCategoryCode(next === 'receipt' ? 3000 : 4010);
          }}
          options={[
            {
              value: 'receipt',
              label: 'RECEIPT',
              sublabel: 'Money In / Income',
              icon: <ArrowDownLeft className="w-4 h-4" />,
              tone: 'success'
            },
            {
              value: 'payment',
              label: 'PAYMENT',
              sublabel: 'Money Out / Expense',
              icon: <ArrowUpRight className="w-4 h-4" />,
              tone: 'danger'
            }
          ]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EnhancedDatePicker label="Date" type="receive" required value={date} onChange={setDate} />
          <Input
            type="number"
            required
            min={1}
            label="Amount (PKR)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 5000"
            className="[&_input]:font-bold [&_input]:text-slate-900 dark:[&_input]:text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DropdownSelect
            label={isReceipt ? 'Income Category' : 'Expense Category'}
            required
            value={String(categoryCode)}
            onChange={(v) => setCategoryCode(Number(v))}
            options={categories.map((c) => ({ value: String(c.value), label: c.label }))}
          />
          <DropdownSelect
            label="Money Account (Method)"
            required
            value={String(payAccountCode)}
            onChange={(v) => setPayAccountCode(Number(v))}
            options={paymentAccounts.map((a) => ({
              value: String(a.code),
              label: `${a.name}${a.code === 1000 ? '' : ` (${a.code})`}`
            }))}
          />
        </div>

        {/* Party: customer id for receipts; free-text supplier for payments */}
        {isReceipt ? (
          <DropdownSelect
            label="Customer / Party (optional)"
            searchable
            allowCustom
            placeholder="Select saved party…"
            value={partyName}
            onChange={(name) => {
              setPartyName(name);
              if (!name) {
                setPartyId(null);
                return;
              }
              query<{ id: number; name: string }>('SELECT id, name FROM customers WHERE name = ? LIMIT 1', [
                name
              ]).then((rows) => setPartyId(rows[0]?.id ?? null));
            }}
            options={partyOptions.map((p) => ({ value: p.name, label: p.name }))}
          />
        ) : (
          <Input
            type="text"
            label="Payee / Supplier Name *"
            value={partySupplierName}
            onChange={(e) => setPartySupplierName(e.target.value)}
            placeholder="e.g. Market Parts Co"
          />
        )}

        {/* Job reference + balance preview */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <Input
            type="text"
            label="Reference Repair Job / Token (optional)"
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
            placeholder="e.g. PTS-001"
          />
          {jobInfo && isReceipt && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden bg-white dark:bg-slate-900 text-xs">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-semibold text-slate-500">Repair Charges</span>
                <MoneyText amount={Number(jobInfo.job.charges) || 0} />
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-semibold text-slate-500">Discount</span>
                <MoneyText amount={Number(jobInfo.job.discount) || 0} />
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-semibold text-slate-500">Previously Paid</span>
                <MoneyText amount={jobInfo.paid} />
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="font-bold text-slate-600 dark:text-slate-300 uppercase">Balance Due</span>
                <MoneyText
                  amount={jobInfo.balance}
                  bold
                  tone={jobInfo.balance > 0 ? 'negative' : 'positive'}
                />
              </div>
            </div>
          )}
        </div>

        <Input
          type="text"
          required
          label="Description / Purpose"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Received full repair charges for Dell XPS laptop"
        />
        <Input
          type="text"
          label="Additional Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Paid via JazzCash TxID: 9812498"
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} loading={isSubmitting} icon={<CheckCircle2 className="w-4 h-4" />}>
            Post Voucher
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default VoucherForm;
