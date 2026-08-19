import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Download, Check, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { query } from '../../lib/db';
import { Job } from '../../types/job';
import { useSettingsStore } from '../../store/settings';
import { formatCurrency, formatDate } from '../../lib/utils';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { exportElementToPDF, triggerPrintWindow } from '../../lib/print-utils';
import { ProTechLogo } from '../../components/shared/ProTechLogo';

export const PrintPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettingsStore();

  const [job, setJob] = useState<Job | null>(null);
  const [template, setTemplate] = useState<'58' | '80' | 'a4'>(
    (settings.thermal_size as '58' | '80' | 'a4') || '80'
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
        if (res.length > 0) setJob(res[0]);
      });
    }
  }, [id]);

  if (!job) {
    return <div className="py-20 text-center text-slate-400">Loading print preview...</div>;
  }

  const handlePrint = () => {
    triggerPrintWindow('printable-content');
  };

  const handleDownloadPDF = async () => {
    toast.info('Generating PDF document...');
    await exportElementToPDF('printable-content', `Repair_Invoice_${job.token_number}.pdf`);
    toast.success('PDF downloaded successfully.');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/jobs/${job.id}`)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Print Ticket / Invoice</h1>
            <p className="text-xs text-slate-500">Preview and print thermal receipt or official A4 invoice for {job.token_number}</p>
          </div>
        </div>

        {/* Action Buttons */}
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

      {/* Template Selector Tabs */}
      <div className="no-print flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl max-w-md mx-auto">
        <button
          onClick={() => setTemplate('58')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            template === '58'
              ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Thermal 58mm
        </button>
        <button
          onClick={() => setTemplate('80')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            template === '80'
              ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Thermal 80mm
        </button>
        <button
          onClick={() => setTemplate('a4')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            template === 'a4'
              ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          A4 Full Invoice
        </button>
      </div>

      {/* Printable Area Wrapper (White paper background simulation) */}
      <div className="flex justify-center bg-slate-200 dark:bg-slate-950 p-8 rounded-2xl shadow-inner min-h-[500px]">
        <div
          id="printable-content"
          className="bg-white text-black shadow-2xl p-6 font-sans text-left transition-all"
          style={{
            width: template === '58' ? '220px' : template === '80' ? '302px' : '650px',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          {/* Header Shop Info */}
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
            {settings.show_logo_on_receipt !== '0' && settings.logo_path && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
                <img src={settings.logo_path} alt="Logo" style={{ maxHeight: template === 'a4' ? '48px' : '36px', objectFit: 'contain' }} />
              </div>
            )}
            <h2 style={{ fontSize: template === 'a4' ? '22px' : '16px', fontWeight: 'bold', margin: '0 0 2px 0' }}>
              {settings.shop_name || 'ProTech Repair Center'}
            </h2>
            {settings.shop_slogan && (
              <p style={{ fontSize: '10px', color: '#555', margin: '0 0 4px 0', fontStyle: 'italic' }}>
                {settings.shop_slogan}
              </p>
            )}
            <p style={{ fontSize: '11px', margin: '0 0 2px 0' }}>{settings.shop_address}</p>
            <p style={{ fontSize: '11px', margin: '0', fontWeight: 'bold' }}>
              Phone: {settings.shop_mobile}
              {settings.shop_whatsapp && settings.shop_whatsapp !== settings.shop_mobile && ` | WA: ${settings.shop_whatsapp}`}
            </p>
          </div>

          {/* Token Display Banner */}
          <div style={{ textAlign: 'center', backgroundColor: '#f1f5f9', padding: '6px', borderRadius: '4px', marginBottom: '12px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', display: 'block' }}>Repair Token #</span>
            <span style={{ fontSize: template === 'a4' ? '24px' : '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>
              {job.token_number}
            </span>
          </div>

          {/* Details Table */}
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginBottom: '12px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '3px 0', color: '#555' }}>Customer:</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 'bold' }}>{job.customer_name}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0', color: '#555' }}>Phone:</td>
                <td style={{ padding: '3px 0', textAlign: 'right' }}>{job.customer_mobile}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0', color: '#555' }}>Device Type:</td>
                <td style={{ padding: '3px 0', textAlign: 'right', textTransform: 'uppercase', fontWeight: 'bold' }}>{job.job_type}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0', color: '#555' }}>Model:</td>
                <td style={{ padding: '3px 0', textAlign: 'right' }}>{job.model || 'N/A'}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0', color: '#555' }}>Serial #:</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontFamily: 'monospace' }}>{job.serial_no || 'N/A'}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0', color: '#555' }}>Receive Date:</td>
                <td style={{ padding: '3px 0', textAlign: 'right' }}>{formatDate(job.receive_date)}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0', color: '#555' }}>Return Date:</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 'bold' }}>{formatDate(job.return_date)}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0', color: '#555' }}>Charger Included:</td>
                <td style={{ padding: '3px 0', textAlign: 'right' }}>{job.has_charger ? 'YES' : 'NO'}</td>
              </tr>
            </tbody>
          </table>

          {/* Fault Symptoms */}
          <div style={{ borderTop: '1px solid #ddd', padding: '8px 0', marginBottom: '12px' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#555', display: 'block' }}>Reported Symptoms:</span>
            <p style={{ fontSize: '11px', margin: '4px 0 0 0', fontStyle: 'italic' }}>{job.symptoms || 'N/A'}</p>
          </div>

          {/* Charges Banner */}
          <div style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '8px 0', margin: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Total Repair Charges:</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatCurrency(job.charges)}</span>
          </div>

          {/* Status Badge */}
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', border: '1px solid #000', borderRadius: '4px', textTransform: 'uppercase' }}>
              Payment: {job.payment_status} | Delivery: {job.deliver_status}
            </span>
          </div>

          {/* Terms and conditions */}
          {settings.receipt_terms && (
            <div style={{ fontSize: '9px', color: '#555', borderTop: '1px dotted #ccc', paddingTop: '6px', marginBottom: '10px', whiteSpace: 'pre-line' }}>
              {settings.receipt_terms}
            </div>
          )}

          {/* QR Code and Footer Signature */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed #000', paddingTop: '10px', marginTop: '10px' }}>
            <div style={{ flex: 1, fontSize: '9px', color: '#444' }}>
              <p style={{ margin: '0 0 2px 0' }}>{settings.receipt_footer_msg || '* Please present this ticket at collection.'}</p>
            </div>
            {settings.show_qr_on_receipt !== '0' && (
              <div style={{ textAlign: 'right', marginLeft: '10px' }}>
                <QRCodeDisplay value={job.token_number} size={template === 'a4' ? 64 : 48} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
