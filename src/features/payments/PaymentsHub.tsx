import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  BookOpen,
  BarChart3,
  Plus
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { KpiCard } from '../../components/ui/KpiCard';
import { Button } from '../../components/ui/Button';
import { useFinanceData } from './hooks/useFinanceData';
import { VouchersTab } from './VouchersTab';
import { InvoicesTab } from './InvoicesTab';
import { PartyLedgerTab } from './PartyLedgerTab';
import { ReportsTab } from './ReportsTab';
import { VoucherForm } from './VoucherForm';

type HubTab = 'vouchers' | 'invoices' | 'ledger' | 'reports';

const TABS: Array<{ key: HubTab; label: string; icon: React.ReactNode }> = [
  { key: 'vouchers', label: 'Vouchers', icon: <Receipt className="w-3.5 h-3.5" /> },
  { key: 'invoices', label: 'Invoices', icon: <FileText className="w-3.5 h-3.5" /> },
  { key: 'ledger', label: 'Party Ledger', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { key: 'reports', label: 'Reports', icon: <BarChart3 className="w-3.5 h-3.5" /> }
];

/**
 * Payments & Ledger hub — the redesigned financial module. Four focused tabs
 * (balanced vouchers, first-class invoices, party ledgers, account reports)
 * replace the old 1,421-line monolith + disconnected General Ledger page.
 */
export const PaymentModulePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as HubTab) || 'vouchers';
  const [tab, setTab] = useState<HubTab>(
    TABS.some((t) => t.key === initialTab) ? initialTab : 'vouchers'
  );
  const [isVoucherFormOpen, setIsVoucherFormOpen] = useState(false);
  const [voucherFlow, setVoucherFlow] = useState<'receipt' | 'payment'>('receipt');

  const finance = useFinanceData();

  const switchTab = (t: HubTab) => {
    setTab(t);
    setSearchParams({ tab: t }, { replace: true });
  };

  const openNewVoucher = (flow: 'receipt' | 'payment' = 'receipt') => {
    setVoucherFlow(flow);
    setIsVoucherFormOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <PageHeader
        title="Payments & Ledger"
        subtitle="Balanced vouchers, invoices, party ledgers and account reports — one connected financial core"
        actions={
          <>
            <Button variant="secondary" onClick={() => openNewVoucher('payment')} icon={<ArrowUpRight className="w-4 h-4" />}>
              Record Payment
            </Button>
            <Button variant="success" onClick={() => openNewVoucher('receipt')} icon={<ArrowDownLeft className="w-4 h-4" />}>
              Record Receipt
            </Button>
          </>
        }
      />

      {/* KPI row */}
      {finance.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Net Position"
            value={formatRs(finance.stats.net_balance)}
            sub="Total receipts minus payments"
            tone={finance.stats.net_balance >= 0 ? 'success' : 'danger'}
            icon={<Wallet className="w-5 h-5" />}
          />
          <KpiCard
            label="Total Receipts"
            value={`+${formatRs(finance.stats.total_receipts)}`}
            sub={`Today: +${formatRs(finance.stats.today_receipts)}`}
            tone="success"
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <KpiCard
            label="Total Payments"
            value={`−${formatRs(finance.stats.total_payments)}`}
            sub={`Today: −${formatRs(finance.stats.today_payments)}`}
            tone="danger"
            icon={<TrendingDown className="w-5 h-5" />}
          />
          <KpiCard
            label="Vouchers"
            value={String(finance.stats.total_vouchers)}
            sub="Balanced entries on record"
            icon={<Receipt className="w-5 h-5" />}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" role="tablist" aria-label="Finance sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={tab === t.key ? 'tab-active' : 'tab'}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div role="tabpanel">
        {tab === 'vouchers' && (
          <VouchersTab finance={finance} onNewVoucher={() => openNewVoucher('receipt')} />
        )}
        {tab === 'invoices' && <InvoicesTab finance={finance} />}
        {tab === 'ledger' && <PartyLedgerTab finance={finance} />}
        {tab === 'reports' && <ReportsTab finance={finance} />}
      </div>

      <VoucherForm
        open={isVoucherFormOpen}
        onClose={() => setIsVoucherFormOpen(false)}
        onPosted={finance.resetAll}
        accounts={finance.accounts}
        paymentAccounts={finance.paymentAccounts}
        initialFlow={voucherFlow}
      />
    </motion.div>
  );
};

function formatRs(n: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  })
    .format(n)
    .replace('PKR', 'Rs.');
}

export default PaymentModulePage;
