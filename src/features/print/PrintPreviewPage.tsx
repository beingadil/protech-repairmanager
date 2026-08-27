import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Download,
  Receipt,
  FileText,
  BadgeCheck,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  ScanLine
} from 'lucide-react';
import { toast } from 'sonner';
import { query } from '../../lib/db';
import { Job } from '../../types/job';
import { FinancialTransaction } from '../../types/payment';
import { useSettingsStore } from '../../store/settings';
import {
  printDocument,
  saveDocumentPdf,
  listPrinters,
  getSavedPrinter,
  savePrinterPreference
} from '../../lib/print-service';
import { buildInvoiceData, InvoiceDocType, InvoicePaper } from '../../lib/invoice';
import { InvoiceDocument } from './InvoiceDocument';

interface PaperMeta {
  label: string;
  desc: string;
  sizeCaption: string;
  defaultZoom: number;
}

const PAPER_OPTIONS: Record<InvoicePaper, PaperMeta> = {
  a4: {
    label: 'A4',
    desc: 'Official invoice',
    sizeCaption: 'A4 | 210 x 297 mm',
    defaultZoom: 1
  },
  '80': {
    label: '80mm',
    desc: 'Thermal receipt',
    sizeCaption: '80mm roll | ~72mm printable',
    defaultZoom: 1.35
  },
  '58': {
    label: '58mm',
    desc: 'Narrow thermal',
    sizeCaption: '58mm roll | ~54mm printable',
    defaultZoom: 1.45
  }
};

const DOC_OPTIONS: { value: InvoiceDocType; label: string; icon: React.ReactNode }[] = [
  { value: 'payment_receipt', label: 'Payment Receipt', icon: React.createElement(Receipt, { className: 'w-3.5 h-3.5' }) },
  { value: 'repair_job', label: 'Repair Ticket', icon: React.createElement(FileText, { className: 'w-3.5 h-3.5' }) },
  { value: 'waiver', label: 'Complimentary', icon: React.createElement(BadgeCheck, { className: 'w-3.5 h-3.5' }) }
];

export const PrintPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings, getInvoiceSettings } = useSettingsStore();
  const invSettings = useMemo(() => getInvoiceSettings(), [settings.invoice_settings]);

  const [job, setJob] = useState<Job | null>(null);
  const [txList, setTxList] = useState<FinancialTransaction[]>([]);
  const [printers, setPrinters] = useState<Array<{ name: string; displayName: string; isDefault: boolean }>>([]);

  const [paper, setPaper] = useState<InvoicePaper>(
    (['58', '80', 'a4'].includes(settings.thermal_size) ? settings.thermal_size : '80') as InvoicePaper
  );
  const [docType, setDocType] = useState<InvoiceDocType>(
    (searchParams.get('type') as InvoiceDocType) || 'payment_receipt'
  );
  // Preview-only magnification. NEVER sent to the print engine.
  const [zoom, setZoom] = useState<number>(() => PAPER_OPTIONS[paper as InvoicePaper].defaultZoom);
  const [printing, setPrinting] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);

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
          // Complimentary jobs default to the waiver document (never a payment receipt).
          if (res[0].payment_status === 'complimentary') {
            setDocType('waiver');
          }
        }
      });
    }
  }, [id]);

  // Ledger history -> real paid / balance figures on the receipt.
  useEffect(() => {
    if (!job) return;
    query<FinancialTransaction>(
      `SELECT * FROM financial_transactions WHERE token_number = ? ORDER BY date ASC, id ASC`,
      [job.token_number]
    ).then(setTxList);
  }, [job]);

  // Correct @page rule + paper marker for the active template.
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

  // Snap preview zoom to a comfortable default whenever the paper changes.
  useEffect(() => {
    setZoom(PAPER_OPTIONS[paper].defaultZoom);
  }, [paper]);

  // Windows printers (MUST stay above the early-return guard - hooks order).
  useEffect(() => {
    listPrinters().then(setPrinters);
  }, []);

  const invoiceData = useMemo(() => {
    if (!job) return null;
    return buildInvoiceData(job, settings, txList, docType, paper, invSettings);
  }, [job, settings, txList, docType, paper, invSettings]);

  if (!job || !invoiceData) {
    return (
      <div className="max-w-3xl mx-auto py-24 text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <p className="mt-4 text-sm font-medium text-slate-400">Preparing print preview...</p>
      </div>
    );
  }

  const handlePrint = async () => {
    setPrinting(true);
    toast.info('Sending document to printer...');
    try {
      await printDocument(invoiceData);
      if ((window as unknown as { prodata?: { print?: unknown } }).prodata?.print) {
        toast.success('Receipt sent to printer.');
      }
    } catch (err) {
      toast.error(`Unable to print: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPDF = async () => {
    const baseName = `${job.token_number}_${
      docType === 'payment_receipt' ? 'Payment-Receipt' : docType === 'waiver' ? 'Complimentary-Waiver' : 'Repair-Ticket'
    }`;
    setSavingPdf(true);
    try {
      const savedPath = await saveDocumentPdf(invoiceData, `${baseName}.pdf`);
      if (savedPath) toast.success(`PDF saved: ${savedPath}`);
    } catch (err) {
      toast.error(`Unable to save PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingPdf(false);
    }
  };

  const currentPrinter =
    getSavedPrinter(paper === 'a4' ? 'a4' : 'thermal') ??
    printers.find((p) => p.isDefault)?.name ??
    '';

  const handlePrinterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!e.target.value) return;
    savePrinterPreference(paper === 'a4' ? 'a4' : 'thermal', e.target.value);
    setPrinters((prev) => [...prev]);
  };

  const changeDocType = (t: InvoiceDocType) => {
    setDocType(t);
    setSearchParams({ type: t }, { replace: true });
  };

  const stepZoom = (dir: number) =>
    setZoom((z) => Math.min(2.5, Math.max(0.6, Number((z + dir * 0.15).toFixed(2)))));

  const showComplimentaryHint = docType === 'payment_receipt' && job.payment_status === 'complimentary';

  return (
    <div className="max-w-5xl mx-auto">
      {/* ---------- Action bar ---------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/jobs/${job.id}`)}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Back to job"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Print &amp; Invoice</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-mono font-semibold">{job.token_number}</span>
              <span className="mx-1.5 opacity-40">/</span>
              {job.customer_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ButtonGhost onClick={handleDownloadPDF} busy={savingPdf} icon={<Download className="w-4 h-4" />} label="Save PDF" />
          <button
            onClick={handlePrint}
            disabled={printing}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            {printing ? 'Printing...' : 'Print Now'}
          </button>
        </div>
      </div>

      {/* ---------- Controls: document type + paper size ---------- */}
      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <SegmentCard label="Document Type">
          {DOC_OPTIONS.map((opt) => (
            <SegButton key={opt.value} active={docType === opt.value} onClick={() => changeDocType(opt.value)}>
              {opt.icon}
              {opt.label}
            </SegButton>
          ))}
        </SegmentCard>
        <SegmentCard label="Paper Size">
          {(Object.keys(PAPER_OPTIONS) as InvoicePaper[]).map((key) => {
            const meta = PAPER_OPTIONS[key];
            return (
              <SegButton key={key} active={paper === key} onClick={() => setPaper(key)} grow>
                <span className="font-black">{meta.label}</span>
                <span className="block text-[10px] font-medium normal-case opacity-70 -mt-0.5">{meta.desc}</span>
              </SegButton>
            );
          })}
        </SegmentCard>
      </div>

      {showComplimentaryHint && (
        <div className="mt-3 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          This job is COMPLIMENTARY (no payment required). Use the Complimentary document instead.
        </div>
      )}

      {/* ---------- Printer ---------- */}
      {printers.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            {paper === 'a4' ? 'A4 Printer' : 'Thermal Printer'}
          </span>
          <select
            value={currentPrinter}
            onChange={handlePrinterChange}
            className="input-field max-w-md text-xs py-1.5 flex-1 min-w-[220px]"
          >
            {printers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName}
                {p.isDefault ? ' (Windows Default)' : ''}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-slate-400 ml-auto">Remembered per paper size</span>
        </div>
      )}

      {/* ---------- Paper stage ---------- */}
      <div className="relative mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 overflow-hidden">
        {/* size + printer chips */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-xs">
            <ScanLine className="w-3 h-3" />
            {PAPER_OPTIONS[paper].sizeCaption}
          </span>
          {currentPrinter && (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-500 dark:text-slate-400 shadow-xs max-w-[260px] truncate">
              {currentPrinter}
            </span>
          )}
        </div>

        {/* scrollable sheet area */}
        <div className="max-h-[68vh] overflow-auto p-6 sm:p-10 flex justify-center">
          <div
            className="bg-white rounded-[3px] ring-1 ring-black/10 shadow-2xl w-fit"
            style={{ zoom }}
          >
            <InvoiceDocument data={invoiceData} />
          </div>
        </div>

        {/* floating zoom pill */}
        <div className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-lg px-1.5 py-1">
          <ZoomBtn onClick={() => stepZoom(-1)}><ZoomOut className="w-3.5 h-3.5" /></ZoomBtn>
          <span className="px-1.5 text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300 min-w-[44px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <ZoomBtn onClick={() => stepZoom(1)}><ZoomIn className="w-3.5 h-3.5" /></ZoomBtn>
          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <ZoomBtn onClick={() => setZoom(1)}>
            <span className="text-[11px] font-bold px-0.5">1:1</span>
          </ZoomBtn>
        </div>
      </div>
    </div>
  );
};

/* ---------------- small presentational helpers ---------------- */

function SegmentCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <span className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">{label}</span>
      <div className="flex items-stretch gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">{children}</div>
    </div>
  );
}

function SegButton({
  active,
  onClick,
  children,
  grow = false
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex ${grow ? 'flex-1' : ''} items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
        active
          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function ButtonGhost({
  onClick,
  busy,
  icon,
  label
}: {
  onClick: () => void;
  busy: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
    >
      {icon}
      {busy ? 'Saving...' : label}
    </button>
  );
}

function ZoomBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-7 h-7 inline-flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
    >
      {children}
    </button>
  );
}

export default PrintPreviewPage;
