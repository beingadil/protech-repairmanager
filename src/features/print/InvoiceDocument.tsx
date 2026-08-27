import React from 'react';
import { InvoiceData, InvoicePaper } from '../../lib/invoice';
import { formatCurrency, formatDate } from '../../lib/utils';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';

/**
 * Pure presentational layer of the printing engine.
 *
 * Receives an ALREADY-PREPARED `InvoiceData` (see src/lib/invoice.ts) and renders
 * a paper-specific template. No database access and no money math here — the
 * three templates (A4 / 80mm / 58mm) share the same business data.
 */

interface Props {
  data: InvoiceData;
}

// Per-paper presentation scale (fonts, spacing, QR).
// NOTE: content width is the PRINTABLE width, not media width. The Bixolon
// SRP-Q302/E302 series prints ~72mm max on 80mm media — an 80mm-wide block
// would be clipped or shifted by the driver, so thermal content stays under.
const PRESENTATION: Record<
  InvoicePaper,
  { width: string; base: number; title: number; token: number; qr: number }
> = {
  a4: { width: '188mm', base: 12, title: 19, token: 13, qr: 66 },   // 210 − 2×11mm margins
  80: { width: '72mm', base: 12, title: 17, token: 14, qr: 48 },    // Bixolon printable max
  58: { width: '54mm', base: 11, title: 15, token: 12, qr: 42 }     // 58 − guides/margins
};

function txt(px: number) {
  return `${px}px`;
}
export const InvoiceDocument: React.FC<Props> = ({ data }) => {
  const p = PRESENTATION[data.paper];
  const s = data.shop;
  const c = data.customer;
  const r = data.repair;
  const pay = data.payment;

  // Which sections appear for this document type.
  const isRepair = data.docType === 'repair_job';
  const isWaiver = data.docType === 'waiver';
  const isPayment = data.docType === 'payment_receipt';
  const thermal = data.paper === '80' || data.paper === '58';

  const qrVisible = s.showQr;
  const f = (n: number) => formatCurrency(n);

  const Row = ({
    label,
    value,
    bold = false,
    extraColor
  }: {
    label: string;
    value: string;
    bold?: boolean;
    extraColor?: string;
  }) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '6px',
        padding: '1.5px 0',
        fontSize: txt(p.base)
      }}
    >
      <span style={{ color: '#555', fontWeight: 600 }}>{label}</span>
      <span
        style={{
          textAlign: 'right',
          fontWeight: bold ? 800 : 600,
          color: extraColor || '#111',
          wordBreak: 'break-word',
          maxWidth: '72%'
        }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div
      id="printable-content"
      data-paper={data.paper}
      style={{
        width: p.width,
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: '#111',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* ── Header ── */}
      <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '8px' }}>
        {s.showLogo && s.logoPath && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
            <img
              src={s.logoPath}
              alt="Logo"
              style={{ maxHeight: thermal ? '34px' : '48px', objectFit: 'contain' }}
            />
          </div>
        )}
        <div style={{ fontSize: txt(p.title), fontWeight: 800 }}>{s.name}</div>
        {s.slogan && (
          <div style={{ fontSize: txt(p.base - 2), fontStyle: 'italic', color: '#555' }}>
            {s.slogan}
          </div>
        )}
        {s.address && (
          <div style={{ fontSize: txt(p.base - 2), marginTop: '2px' }}>{s.address}</div>
        )}
        <div style={{ fontSize: txt(p.base - 1), fontWeight: 700 }}>
          Phone: {s.phone}
          {s.whatsapp && s.whatsapp !== s.phone ? ` | WA: ${s.whatsapp}` : ''}
        </div>
      </div>

      {/* ── Document title + token ── */}
      <div style={{ textAlign: 'center', margin: '8px 0 4px' }}>
        <div
          style={{
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontSize: txt(p.base),
            fontWeight: 800
          }}
        >
          {isWaiver ? 'Complimentary Waiver' : isRepair ? 'Repair Job Ticket' : 'Payment Receipt'}
        </div>
        <div style={{ marginTop: '2px', fontSize: txt(p.token), fontWeight: 700, fontFamily: 'monospace' }}>
          Token: {r.token}
        </div>
      </div>

      {/* ── Customer ── */}
      <Row label="Customer" value={c.name} bold />
      {c.mobile && <Row label="Phone" value={c.mobile} />}

      {/* ── Repair job details (repair ticket only) ── */}
      {isRepair && (
        <div style={{ marginTop: '2px' }}>
          <Row label="Device" value={r.deviceType} />
          <Row label="Model" value={r.model} />
          {r.serialNo !== '—' && <Row label="Serial #" value={r.serialNo} />}
          {r.ram !== '—' && <Row label="RAM" value={r.ram} />}
          {r.hard !== '—' && <Row label="Storage" value={r.hard} />}
          {r.processor !== '—' && <Row label="Processor" value={r.processor} />}
          <Row label="Receive Date" value={r.receiveDate ? formatDate(r.receiveDate) : '—'} />
          <Row label="Expected Return" value={r.returnDate ? formatDate(r.returnDate) : '—'} bold />
          <Row label="Charger" value={r.hasCharger ? 'YES' : 'NO'} />
          {r.symptoms && (
            <div style={{ marginTop: '4px', borderTop: '1px solid #ddd', paddingTop: '4px' }}>
              <div
                style={{
                  fontSize: txt(p.base - 2),
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#555'
                }}
              >
                Reported Symptoms
              </div>
              <div
                style={{
                  fontStyle: 'italic',
                  fontSize: txt(p.base - 1),
                  marginTop: '2px',
                  wordBreak: 'break-word'
                }}
              >
                {r.symptoms}
              </div>
            </div>
          )}
          {/* Charges banner for the repair job ticket */}
          <div
            style={{
              borderTop: '2px solid #000',
              borderBottom: '2px solid #000',
              padding: '6px 0',
              marginTop: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: txt(p.base - 1), fontWeight: 800 }}>Estimated Charges</span>
            <span style={{ fontSize: txt(p.base + 1), fontWeight: 800 }}>{f(pay.charges)}</span>
          </div>
        </div>
      )}

      {/* ── Waiver note ── */}
      {isWaiver && (
        <div
          style={{
            marginTop: '8px',
            borderTop: '1px solid #000',
            borderBottom: '1px solid #000',
            textAlign: 'center',
            padding: '8px 4px'
          }}
        >
          <div style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: txt(p.base + 1) }}>
            No Payment Required
          </div>
          <div style={{ fontSize: txt(p.base - 1), color: '#555', marginTop: '2px' }}>
            This repair/job was provided complimentary (waived).
          </div>
        </div>
      )}

      {/* ── Financial summary (payment receipt + waiver) ── */}
      {(isPayment || isWaiver) && !isRepair && (
        <div
          style={{
            marginTop: '6px',
            borderTop: '2px solid #000',
            borderBottom: '2px solid #000',
            padding: '6px 0'
          }}
        >
          <Row label="Repair Charges" value={f(pay.charges)} />
          {pay.discount > 0 && <Row label="Discount" value={`- ${f(pay.discount)}`} />}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '6px',
              padding: '4px 0',
              borderTop: '1px solid #ddd',
              fontSize: txt(p.base + 1),
              fontWeight: 800
            }}
          >
            <span>NET AMOUNT</span>
            <span>{f(pay.netAmount)}</span>
          </div>
          <Row label="Paid" value={f(pay.paid)} bold />
          <Row label="Balance" value={f(pay.balance)} bold extraColor={pay.balance > 0 ? '#b91c1c' : '#166534'} />

          {isPayment && (
            <div style={{ marginTop: '4px', borderTop: '1px solid #ddd', paddingTop: '4px' }}>
              <Row label="Payment Method" value={data.paymentInfo.latestMethod} />
              {data.paymentInfo.latestDate && (
                <Row label="Payment Date" value={formatDate(data.paymentInfo.latestDate)} />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Footer: message + terms + QR ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          borderTop: '1px dashed #000',
          paddingTop: '6px',
          marginTop: '8px'
        }}
      >
        <div style={{ flex: 1, fontSize: txt(p.base - 3), color: '#444', minWidth: 0 }}>
          <div style={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
            {s.footerMsg || 'Thank you for choosing ProTech Services.'}
          </div>
          {s.terms && (
            <div style={{ whiteSpace: 'pre-line', marginTop: '3px', color: '#666' }}>{s.terms}</div>
          )}
        </div>
        {qrVisible && (
          <div style={{ textAlign: 'right', marginLeft: '6px', flexShrink: 0 }}>
            <QRCodeDisplay value={r.token} size={p.qr} />
          </div>
        )}
      </div>
      {!qrVisible && (
        <div style={{ fontSize: txt(p.base - 3), color: '#888', marginTop: '4px' }}>{s.name}</div>
      )}
    </div>
  );
};

export default InvoiceDocument;