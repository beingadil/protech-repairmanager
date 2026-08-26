import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, Download, Receipt, FileText, BadgeCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { query } from '../../lib/db';
import { Job } from '../../types/job';
import { FinancialTransaction } from '../../types/payment';
import { useSettingsStore } from '../../store/settings';
import { exportElementToPDF, triggerPrintWindow } from '../../lib/print-utils';
import { buildInvoiceData, InvoiceDocType, InvoicePaper } from '../../lib/invoice';
import { InvoiceDocument } from './InvoiceDocument';

const PAPER_OPTIONS: { value: InvoicePaper; label: string; desc: string }[] = [
  { value: 'a4', label: 'A4', desc: 'Official invoice' },
  { value: '80', label: '80mm', desc: 'Thermal receipt' },
  { value: '58', label: '58mm', desc: 'Narrow thermal' }
];

const DOC_OPTIONS: { value: InvoiceDocType; label: string; icon: React.ReactNode }[] = [
  { value: 'payment_receipt', label: 'Payment Receipt', icon: React.createElement(Receipt, { className: 'w-3.5 h-3.5' }) },
  { value: 'repair_job', label: 'Repair Ticket', icon: React.createElement(FileText, { className: 'w-3.5 h-3.5' }) },
  { value: 'waiver', label: 'Complimentary', icon: React.createElement(BadgeCheck, { className: 'w-3.5 h-3.5' }) }
];

export const PrintPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useSettingsStore();

  const [job, setJob] = useState<Job | null>(null);
  const [txList, setTxList] = useState<FinancialTransaction[]>([]);

  const [paper, setPaper] = useState<InvoicePaper>(
    (['58', '80', 'a4'].includes(settings.thermal_size) ? settings.thermal_size : '80') as InvoicePaper
  );
  const [docType, setDocType] = useState<InvoiceDocType>(
    (searchParams.get('type') as InvoiceDocType) || 'payment_receipt'
  );

  useEffect(() => {
    if (id) {
      query<Job>(
        `SELECT j.*, c.name as customer_name, c.mobile as customer_mobile, c.address as customer_address
         FROM jobs j
         JOIN customers c ON j.customer_id = c.id
         WHERE j.id = ? AND j.deleted_at IS NULL LIMIT 1`,
        [parseInt(id, 10)]
      ).then((res) => {
        if (res.length > 0) {
          setJob(res[0]);
          // Complimentary jobs default to the waiver document — never a fake payment receipt.
          if (res[0].payment_status === 'complimentary') {
            setDocType('waiver');
          }
        }
      });
    }
  }, [id]);

  // Load ledger history so the receipt shows real paid / balance amounts.
  useEffect(() => {
    if (!job) return;
    query<FinancialTransaction>(
      `SELECT * FROM financial_transactions WHERE token_number = ? ORDER BY date ASC, id ASC`,
      [job.token_number]
    ).then(setTxList);
  }, [job]);

  // Inject the correct @page rule + paper marker for the active template.
  useEffect(() => {
    const styleId = 'print-page-size';
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent =
      paper === 'a4'
        ? '@page { size: A4 portrait; margin: 6mm; }'
        : `@page { size: ${paper}mm auto; margin: 0; }`;

    document.documentElement.setAttribute('data-paper', paper);
    return () => document.documentElement.removeAttribute('data-paper');
  }, [paper]);

  const invoiceData = useMemo(() => {
    if (!job) return null;
    return buildInvoiceData(job, settings, txList, docType, paper);
  }, [job, settings, txList, docType, paper]);

  if (!job || !invoiceData) {
    return <div className="py-20 text-center text-slate-400">Loading print preview...</div>;
  }

  const handlePrint = () => triggerPrintWindow('printable-content');

  const handleDownloadPDF = async () => {
    toast.info('Generating PDF document...');
    await exportElementToPDF('printable-content', `${job.token_number}_${docType}.pdf`);
    toast.success('PDF downloaded successfully.');
  };

  const changeDocType = (t: InvoiceDocType) => {
    setDocType(t);
    setSearchParams({ type: t }, { replace: true });
  };

  const showComplimentaryHint = docType === 'payment_receipt' && job.payment_status === 'complimentary';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="print-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/jobs/${job.id}`)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">
              Print / Invoice
            </h1>
            <p className="text-xs text-slate-500">
              {job.token_number} — {job.customer_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Save PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Now</span>
          </button>
        </div>
      </div>

      <div className="print-toolbar">
        <span className="muted-label block mb-2">Document Type</span>
        <div className="flex flex-wrap items-center gap-2">
          {DOC_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => changeDocType(opt.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${docType === opt.value
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
        {showComplimentaryHint && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4" />
            This job is COMPLIMENTARY (no payment required). Use the Complimentary document instead.
          </div>
        )}
      </div>

      <div className="print-toolbar flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
        {PAPER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPaper(opt.value)}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${paper === opt.value
              ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {opt.label}
            <span className="block text-[10px] font-medium normal-case">{opt.desc}</span>
          </button>
        ))}
      </div>

      <div className="print-sheet flex justify-center bg-slate-200 dark:bg-slate-950 p-4 sm:p-8 rounded-2xl shadow-inner min-h-[420px]">
        <div className={paper === 'a4' ? 'shadow-2xl' : 'shadow-md'}>
          <InvoiceDocument data={invoiceData} />
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewPage;