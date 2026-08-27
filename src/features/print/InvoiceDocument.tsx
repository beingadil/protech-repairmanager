import React from 'react';
import { InvoiceData, InvoicePaper } from '../../lib/invoice';
import { formatCurrency, formatDate } from '../../lib/utils';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { DEFAULT_SECTIONS, InvoiceSectionToggles } from '../../lib/invoice-settings';

/**
 * Pure presentational layer of the printing engine.
 *
 * Receives an ALREADY-PREPARED InvoiceData and renders a paper-specific
 * template. No DB access and no money math here. Every visual dimension comes
 * from the per-paper DESIGN theme below, so A4 renders as an airy professional
 * document while thermal sizes stay receipt-compact.
 */

interface Props {
  data: InvoiceData;
}

interface Design {
  width: string;
  base: number;        // normal field text
  small: number;       // secondary text
  title: number;       // shop name
  token: number;       // doc-type heading size
  qr: number;
  gap: string;         // vertical rhythm between sections
  padX: string;        // section horizontal padding
  padY: string;        // section vertical padding
  radius: string;
  rowPad: string;      // FieldRow vertical padding
  headPadB: string;    // shop-header bottom padding
  metaTop: string;     // space above doc-title/meta row
}

// Printable width (not media width): Bixolon prints ~72mm max on 80mm paper.
const DESIGN: Record<InvoicePaper, Design> = {
  a4: {
    width: '188mm', base: 13, small: 11, title: 26, token: 15, qr: 64,
    gap: '16px', padX: '20px', padY: '14px', radius: '10px', rowPad: '7px',
    headPadB: '18px', metaTop: '20px'
  },
  '80': {
    width: '72mm', base: 12, small: 10, title: 18, token: 13, qr: 46,
    gap: '10px', padX: '11px', padY: '9px', radius: '7px', rowPad: '4px',
    headPadB: '10px', metaTop: '10px'
  },
  '58': {
    width: '54mm', base: 11, small: 9, title: 16, token: 12, qr: 38,
    gap: '8px', padX: '9px', padY: '7px', radius: '6px', rowPad: '3px',
    headPadB: '8px', metaTop: '8px'
  }
};

const COLORS = {
  ink: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  lineMid: '#cbd5e1',
  lineStrong: '#334155',
  fill: '#f8fafc',
  red: '#b91c1c',
  green: '#166534'
};

function txt(px: number): string {
  return `${px}px`;
}

function SectionBox({
  d,
  children,
  title,
  accent
}: {
  d: Design;
  children: React.ReactNode;
  title?: string;
  accent?: { border: string; bg: string };
}) {
  return (
    <div
      style={{
        border: `1px solid ${accent ? accent.border : COLORS.lineMid}`,
        borderRadius: d.radius,
        backgroundColor: accent ? accent.bg : '#ffffff',
        padding: `${d.padY} ${d.padX}`,
        marginTop: d.gap
      }}
    >
      {title && (
        <div
          style={{
            fontSize: txt(Math.max(9, Math.round(d.base - 4))),
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1.4px',
            color: COLORS.faint,
            borderBottom: `1px solid ${COLORS.line}`,
            paddingBottom: d.rowPad,
            marginBottom: d.rowPad
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
  d,
  label,
  value,
  bold = false,
  valueColor
}: {
  d: Design;
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
        alignItems: 'baseline',
        gap: '12px',
        padding: `${d.rowPad} 0`
      }}
    >
      <span style={{ fontSize: txt(d.small), color: COLORS.muted, fontWeight: 600 }}>
        {label}
      </span>
      <span
        style={{
          textAlign: 'right',
          fontSize: txt(bold ? d.base : d.base),
          fontWeight: bold ? 800 : 600,
          color: valueColor || COLORS.ink,
          wordBreak: 'break-word',
          maxWidth: '68%'
        }}
      >
        {value}
      </span>
    </div>
  );
}

export const InvoiceDocument: React.FC<Props> = ({ data }) => {
  const d = DESIGN[data.paper];
  const s = data.shop;
  const c = data.customer;
  const r = data.repair;
  const pay = data.payment;

  const isRepair = data.docType === 'repair_job';
  const isWaiver = data.docType === 'waiver';
  const isPayment = data.docType === 'payment_receipt';
  const thermal = data.paper === '80' || data.paper === '58';

  const qrVisible = s.showQr;
  const cfg: InvoiceSectionToggles = data.invCfg || { ...DEFAULT_SECTIONS };
  const f = (n: number) => formatCurrency(n);
  const labelSize = Math.max(9, Math.round(d.base - 4));

  return (
    <div
      id="printable-content"
      data-paper={data.paper}
      style={{
        width: d.width,
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: COLORS.ink,
        fontFamily: thermal ? 'Arial, Helvetica, sans-serif' : '"Segoe UI", Arial, sans-serif',
        lineHeight: 1.45,
        padding: thermal ? '0' : '4px'
      }}
    >
      {/* ---------- Shop header ---------- */}
      <header
        style={{
          textAlign: 'center',
          borderBottom: `${thermal ? 2 : 3}px solid ${COLORS.lineStrong}`,
          paddingBottom: d.headPadB
        }}
      >
        {cfg.logo && s.showLogo && s.logoPath && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: d.gap ? '8px' : '4px' }}>
            <img
              src={s.logoPath}
              alt="Logo"
              style={{ maxHeight: thermal ? '36px' : '60px', objectFit: 'contain' }}
            />
          </div>
        )}
        {cfg.name && (
          <div
            style={{
              fontSize: txt(d.title),
              fontWeight: 800,
              letterSpacing: thermal ? '0.4px' : '1.5px',
              lineHeight: 1.15
            }}
          >
            {s.name}
          </div>
        )}
        {cfg.tagline && s.slogan && (
          <div
            style={{
              fontSize: txt(d.small),
              fontStyle: 'italic',
              color: COLORS.muted,
              marginTop: thermal ? '2px' : '6px'
            }}
          >
            {s.slogan}
          </div>
        )}
        {cfg.address && s.address && (
          <div
            style={{
              fontSize: txt(d.small),
              color: '#475569',
              marginTop: thermal ? '2px' : '8px',
              maxWidth: thermal ? undefined : '78%',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}
          >
            {s.address}
          </div>
        )}
        {cfg.phone && (
          <div
            style={{
              display: thermal ? 'block' : 'inline-block',
              fontSize: txt(d.base - 1),
              fontWeight: 700,
              marginTop: thermal ? '3px' : '10px',
              ...(thermal
                ? {}
                : {
                    background: COLORS.fill,
                    borderRadius: '999px',
                    padding: '6px 18px',
                    border: `1px solid ${COLORS.line}`
                  })
            }}
          >
            {s.phone && `Phone: ${s.phone}`}
            {!thermal && s.whatsapp && s.whatsapp !== s.phone ? `   |   WhatsApp: ${s.whatsapp}` : ''}
            {thermal && s.whatsapp && s.whatsapp !== s.phone ? ` | WA: ${s.whatsapp}` : ''}
          </div>
        )}
      </header>

      {/* ---------- Document title + token / date ---------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginTop: d.metaTop,
          marginBottom: '4px'
        }}
      >
        <div
          style={{
            fontSize: txt(d.token),
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: thermal ? '0.6px' : '2px'
          }}
        >
          {isWaiver ? 'Complimentary Waiver' : isRepair ? 'Repair Job Ticket' : 'Payment Receipt'}
        </div>
        {(cfg.token || cfg.date) && (
          <div style={{ textAlign: 'right', lineHeight: 1.5 }}>
            {cfg.token && (
              <div style={{ fontSize: txt(d.base), fontWeight: 700 }}>
                Token: <span style={{ fontFamily: 'monospace' }}>{r.token}</span>
              </div>
            )}
            {cfg.date && (
              <div style={{ fontSize: txt(d.small), color: COLORS.muted }}>
                {data.issuedAt ? data.issuedAt : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- Customer ---------- */}
      <SectionBox d={d} title="Bill To">
        {cfg.customerName && <FieldRow d={d} label="Customer" value={c.name} bold />}
        {cfg.customerPhone && c.mobile && <FieldRow d={d} label="Phone" value={c.mobile} />}
        {cfg.customerAddress && c.address && <FieldRow d={d} label="Address" value={c.address} />}
      </SectionBox>

      {/* ---------- Repair details ---------- */}
      {isRepair && (
        <SectionBox d={d} title="Repair Job Details">
          {cfg.device && <FieldRow d={d} label="Device" value={r.deviceType} />}
          {cfg.model && <FieldRow d={d} label="Model" value={r.model} />}
          {cfg.serial && r.serialNo !== '\u2014' && <FieldRow d={d} label="Serial #" value={r.serialNo} />}
          {cfg.specs && r.ram !== '\u2014' && <FieldRow d={d} label="RAM" value={r.ram} />}
          {cfg.specs && r.hard !== '\u2014' && <FieldRow d={d} label="Storage" value={r.hard} />}
          {cfg.specs && r.processor !== '\u2014' && <FieldRow d={d} label="Processor" value={r.processor} />}
          {cfg.receiveDate && (
            <FieldRow d={d} label="Receive Date" value={r.receiveDate ? formatDate(r.receiveDate) : '\u2014'} />
          )}
          {cfg.returnDate && (
            <FieldRow
              d={d}
              label="Expected Return"
              value={r.returnDate ? formatDate(r.returnDate) : '\u2014'}
              bold
            />
          )}
          {cfg.charger && <FieldRow d={d} label="Charger" value={r.hasCharger ? 'YES' : 'NO'} />}
          {cfg.symptoms && r.symptoms && (
            <div
              style={{
                marginTop: d.rowPad,
                borderTop: `1px solid ${COLORS.line}`,
                paddingTop: d.rowPad
              }}
            >
              <div style={{ fontSize: txt(labelSize), fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.faint }}>
                Reported Symptoms
              </div>
              <div
                style={{
                  fontStyle: 'italic',
                  fontSize: txt(d.base - 1),
                  color: '#475569',
                  marginTop: '3px',
                  wordBreak: 'break-word'
                }}
              >
                {r.symptoms}
              </div>
            </div>
          )}
        </SectionBox>
      )}

      {/* ---------- Estimated charges banner (repair ticket) ---------- */}
      {isRepair && cfg.estimatedCharges && (
        <div
          style={{
            marginTop: d.gap,
            border: `2px solid ${COLORS.lineStrong}`,
            borderRadius: d.radius,
            padding: `${thermal ? '7px' : '12px'} ${d.padX}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: COLORS.fill
          }}
        >
          <span style={{ fontSize: txt(d.base), fontWeight: 800, letterSpacing: '0.5px' }}>
            Estimated Charges
          </span>
          <span style={{ fontSize: txt(d.base + 3), fontWeight: 800 }}>{f(pay.charges)}</span>
        </div>
      )}

      {/* ---------- Waiver note ---------- */}
      {isWaiver && (
        <SectionBox
          d={d}
          accent={{ border: COLORS.green, bg: '#f0fdf4' }}
        >
          <div style={{ textAlign: 'center', padding: `${thermal ? '2px' : '8px'} 0` }}>
            <div
              style={{
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontSize: txt(d.base + 1),
                color: COLORS.green
              }}
            >
              {'\u2713'} No Payment Required
            </div>
            <div style={{ fontSize: txt(d.small), color: '#475569', marginTop: '4px' }}>
              This repair was provided complimentary (waived).
            </div>
          </div>
        </SectionBox>
      )}

      {/* ---------- Payment summary ---------- */}
      {(isPayment || isWaiver) && !isRepair && (
        <SectionBox d={d} title="Payment Summary">
          {/* column headers */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: txt(labelSize),
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: COLORS.faint,
              borderBottom: `2px solid ${COLORS.lineStrong}`,
              paddingBottom: d.rowPad,
              marginBottom: '2px'
            }}
          >
            <span>Description</span>
            <span>Amount</span>
          </div>

          {cfg.chargesLine && <FieldRow d={d} label="Repair Charges" value={f(pay.charges)} />}
          {cfg.discount && pay.discount > 0 && (
            <FieldRow d={d} label="Discount" value={`${String.fromCharCode(8722)} ${f(pay.discount)}`} valueColor={COLORS.green} />
          )}

          {/* NET band */}
          {cfg.netAmount && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginTop: '3px',
                padding: `${thermal ? '6px' : '10px'} ${thermal ? '6px' : '12px'}`,
                borderRadius: thermal ? '5px' : '8px',
                backgroundColor: COLORS.fill,
                borderTop: `1px solid ${COLORS.lineMid}`,
                borderBottom: `1px solid ${COLORS.lineMid}`,
                fontSize: txt(d.base + 2),
                fontWeight: 800
              }}
            >
              <span style={{ textTransform: 'uppercase', letterSpacing: thermal ? '0.4px' : '1.2px' }}>
                Net Amount
              </span>
              <span>{f(pay.netAmount)}</span>
            </div>
          )}

          <div style={{ marginTop: '3px' }}>
            {cfg.paid && <FieldRow d={d} label="Amount Paid" value={f(pay.paid)} />}
            {cfg.balance && (
              <FieldRow
                d={d}
                label="Balance Due"
                value={f(pay.balance)}
                bold
                valueColor={pay.balance > 0 ? COLORS.red : COLORS.green}
              />
            )}
          </div>

          {isPayment && (cfg.paymentMethod || cfg.paymentDate) && (
            <div
              style={{
                marginTop: d.rowPad,
                borderTop: `1px dashed ${COLORS.lineMid}`,
                paddingTop: d.rowPad
              }}
            >
              {cfg.paymentMethod && (
                <FieldRow d={d} label="Payment Method" value={data.paymentInfo.latestMethod} />
              )}
              {cfg.paymentDate && data.paymentInfo.latestDate && (
                <FieldRow d={d} label="Payment Date" value={formatDate(data.paymentInfo.latestDate)} />
              )}
            </div>
          )}
        </SectionBox>
      )}

      {/* ---------- Terms ---------- */}
      {cfg.terms && s.terms && (
        <SectionBox d={d} title="Terms & Conditions">
          <div
            style={{
              fontSize: txt(d.small),
              color: '#475569',
              whiteSpace: 'pre-line',
              wordBreak: 'break-word',
              lineHeight: 1.6
            }}
          >
            {s.terms}
          </div>
        </SectionBox>
      )}

      {/* ---------- Footer ---------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          borderTop: `1px dashed ${COLORS.lineMid}`,
          paddingTop: d.headPadB,
          marginTop: d.gap
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {cfg.thankYou ? (
            <div
              style={{
                fontSize: txt(thermal ? d.small : d.base + 1),
                fontWeight: thermal ? 600 : 700,
                color: '#334155',
                textAlign: thermal ? 'left' : 'center',
                whiteSpace: 'pre-line',
                wordBreak: 'break-word',
                ...(thermal ? {} : { padding: '6px 0' })
              }}
            >
              {s.footerMsg || 'Thank you for choosing ProTech Services.'}
            </div>
          ) : null}
        </div>
        {cfg.qr && qrVisible && (
          <div style={{ flexShrink: 0, marginLeft: '8px' }}>
            <QRCodeDisplay value={r.token} size={d.qr} />
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceDocument;
