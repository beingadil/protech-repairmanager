import React from 'react';
import { InvoiceData, InvoicePaper } from '../../lib/invoice';
import { formatCurrency, formatDate } from '../../lib/utils';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';

/**
 * Pure presentational layer of the printing engine.
 *
 * Receives an ALREADY-PREPARED `InvoiceData` (see src/lib/invoice.ts) and renders
 * a paper-specific template. No database access and no money math here.
 *
 * Professional invoice styling: boxed sections, aligned totals table, logo
 * header, and a terms box. Self-contained inline styles so it prints
 * identically on A4 / 80mm / 58mm.
 */

interface Props {
  data: InvoiceData;
}

// Per-paper presentation scale (fonts, spacing, QR).
// Content width is the PRINTABLE width, not media width. The Bixolon
// SRP-Q302/E302 series prints ~72mm max on 80mm media.
const PRESENTATION: Record<
  InvoicePaper,
  { width: string; base: number; title: number; token: number; qr: number }
> = {
  a4: { width: '188mm', base: 12, title: 20, token: 13, qr: 66 },
  80: { width: '72mm', base: 12, title: 17, token: 14, qr: 48 },
  58: { width: '54mm', base: 11, title: 15, token: 12, qr: 42 }
};

const COLORS = {
  ink: '#0f172a',
  muted: '#64748b',
  line: '#cbd5e1',
  lineStrong: '#334155',
  fill: '#f1f5f9',
  red: '#b91c1c',
  green: '#166534'
};

function txt(px: number): string {
  return `${px}px`;
}

function SectionBox({
  children,
  style = {},
  title
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.line}`,
        borderRadius: '6px',
        padding: '7px 9px',
        marginTop: '7px',
        ...style
      }}
    >
      {title && (
        <div
          style={{
            fontSize: txt(9),
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: COLORS.muted,
            borderBottom: `1px solid ${COLORS.line}`,
            paddingBottom: '4px',
            marginBottom: '5px'
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function FieldRow({
  label,
  value,
  bold = false,
  valueColor
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '6px',
        padding: '1.5px 0'
      }}
    >
      <span style={{ color: COLORS.muted, fontWeight: 600 }}>{label}</span>
      <span
        style={{
          textAlign: 'right',
          fontWeight: bold ? 800 : 600,
          color: valueColor || COLORS.ink,
          wordBreak: 'break-word',
          maxWidth: '70%'
        }}
      >
        {value}
      </span>
    </div>
  );
}
export const InvoiceDocument: React.FC<Props> = ({ data }) => {
  const p = PRESENTATION[data.paper];
  const s = data.shop;
  const c = data.customer;
  const r = data.repair;
  const pay = data.payment;

  const isRepair = data.docType === 'repair_job';
  const isWaiver = data.docType === 'waiver';
  const isPayment = data.docType === 'payment_receipt';
  const thermal = data.paper === '80' || data.paper === '58';

  const qrVisible = s.showQr;
  const f = (n: number) => formatCurrency(n);

  return (
    <div
      id="printable-content"
      data-paper={data.paper}
      style={{
        width: p.width,
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: COLORS.ink,
        fontFamily: 'Arial, Helvetica, sans-serif'
      }}
    >
      <div
        style={{
          textAlign: 'center',
          borderBottom: `2px solid ${COLORS.lineStrong}`,
          paddingBottom: '8px'
        }}
      >
        {s.showLogo && s.logoPath && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
            <img
              src={s.logoPath}
              alt="Logo"
              style={{ maxHeight: thermal ? '34px' : '52px', objectFit: 'contain' }}
            />
          </div>
        )}
        <div style={{ fontSize: txt(p.title), fontWeight: 800, letterSpacing: '0.5px' }}>
          {s.name}
        </div>
        {s.slogan && (
          <div style={{ fontSize: txt(p.base - 1), fontStyle: 'italic', color: COLORS.muted }}>
            {s.slogan}
          </div>
        )}
        {s.address && (
          <div style={{ fontSize: txt(p.base - 2), marginTop: '3px', color: '#444' }}>
            {s.address}
          </div>
        )}
        <div style={{ fontSize: txt(p.base - 1), fontWeight: 700, marginTop: '2px' }}>
          {s.phone && `Phone: ${s.phone}`}
          {s.whatsapp && s.whatsapp !== s.phone ? `  |  WhatsApp: ${s.whatsapp}` : ''}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          margin: '9px 0 2px'
        }}
      >
        <div style={{ fontSize: txt(p.token), fontWeight: 800, textTransform: 'uppercase' }}>
          {isWaiver ? 'Complimentary Waiver' : isRepair ? 'Repair Job Ticket' : 'Payment Receipt'}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: txt(p.base - 1), fontWeight: 700 }}>
            Token: <span style={{ fontFamily: 'monospace' }}>{r.token}</span>
          </div>
          <div style={{ fontSize: txt(p.base - 2), color: COLORS.muted }}>
            {data.issuedAt ? `Date: ${data.issuedAt}` : ''}
          </div>
        </div>
      </div>

      <SectionBox title="Bill To / Customer">
        <FieldRow label="Customer" value={c.name} bold />
        {c.mobile && <FieldRow label="Phone" value={c.mobile} />}
        {c.address && <FieldRow label="Address" value={c.address} />}
      </SectionBox>

      {isRepair && (
        <SectionBox title="Repair Job Details">
          <FieldRow label="Device" value={r.deviceType} />
          <FieldRow label="Model" value={r.model} />
          {r.serialNo !== '\u2014' && <FieldRow label="Serial #" value={r.serialNo} />}
          {r.ram !== '\u2014' && <FieldRow label="RAM" value={r.ram} />}
          {r.hard !== '\u2014' && <FieldRow label="Storage" value={r.hard} />}
          {r.processor !== '\u2014' && <FieldRow label="Processor" value={r.processor} />}
          <FieldRow label="Receive Date" value={r.receiveDate ? formatDate(r.receiveDate) : '\u2014'} />
          <FieldRow
            label="Expected Return"
            value={r.returnDate ? formatDate(r.returnDate) : '\u2014'}
            bold
          />
          <FieldRow label="Charger" value={r.hasCharger ? 'YES' : 'NO'} />
          {r.symptoms && (
            <div style={{ marginTop: '4px', borderTop: `1px solid ${COLORS.line}`, paddingTop: '4px' }}>
              <div style={{ fontSize: txt(p.base - 2), fontWeight: 700, textTransform: 'uppercase', color: COLORS.muted }}>
                Reported Symptoms
              </div>
              <div style={{ fontStyle: 'italic', fontSize: txt(p.base - 1), marginTop: '2px', wordBreak: 'break-word' }}>
                {r.symptoms}
              </div>
            </div>
          )}
        </SectionBox>
      )}
      {isRepair && (
        <div
          style={{
            marginTop: '7px',
            border: `1px solid ${COLORS.lineStrong}`,
            borderRadius: '6px',
            padding: '6px 9px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: COLORS.fill
          }}
        >
          <span style={{ fontSize: txt(p.base - 1), fontWeight: 800 }}>Estimated Charges</span>
          <span style={{ fontSize: txt(p.base + 1), fontWeight: 800 }}>{f(pay.charges)}</span>
        </div>
      )}

      {isWaiver && (
        <SectionBox style={{ border: `2px solid ${COLORS.green}`, backgroundColor: '#f0fdf4' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: txt(p.base + 1), color: COLORS.green }}>
              \u2713 No Payment Required
            </div>
            <div style={{ fontSize: txt(p.base - 1), color: '#444', marginTop: '2px' }}>
              This repair/job was provided complimentary (waived).
            </div>
          </div>
        </SectionBox>
      )}

      {(isPayment || isWaiver) && !isRepair && (
        <SectionBox title="Payment Summary">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', fontWeight: 800, borderBottom: `1px solid ${COLORS.lineStrong}`, paddingBottom: '3px' }}>
            <span>Description</span>
            <span>Amount</span>
          </div>
          <FieldRow label="Repair Charges" value={f(pay.charges)} />
          {pay.discount > 0 && <FieldRow label="Discount" value={`\u2212 ${f(pay.discount)}`} />}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '6px',
              padding: '4px 0',
              borderTop: `1px solid ${COLORS.line}`,
              borderBottom: `2px solid ${COLORS.lineStrong}`,
              fontSize: txt(p.base + 1),
              fontWeight: 800
            }}
          >
            <span>NET AMOUNT</span>
            <span>{f(pay.netAmount)}</span>
          </div>
          <FieldRow label="Paid" value={f(pay.paid)} bold />
          <FieldRow
            label="Balance"
            value={f(pay.balance)}
            bold
            valueColor={pay.balance > 0 ? COLORS.red : COLORS.green}
          />

          {isPayment && (
            <div style={{ marginTop: '4px', borderTop: `1px solid ${COLORS.line}`, paddingTop: '4px' }}>
              <FieldRow label="Payment Method" value={data.paymentInfo.latestMethod} />
              {data.paymentInfo.latestDate && (
                <FieldRow label="Payment Date" value={formatDate(data.paymentInfo.latestDate)} />
              )}
            </div>
          )}
        </SectionBox>
      )}

      {s.terms && (
        <SectionBox title="Terms & Conditions">
          <div style={{ fontSize: txt(p.base - 2), color: '#444', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
            {s.terms}
          </div>
        </SectionBox>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          borderTop: `1px dashed ${COLORS.lineStrong}`,
          paddingTop: '6px',
          marginTop: '8px'
        }}
      >
        <div style={{ flex: 1, fontSize: txt(p.base - 3), color: '#444', minWidth: 0 }}>
          <div style={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
            {s.footerMsg || 'Thank you for choosing ProTech Services.'}
          </div>
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
