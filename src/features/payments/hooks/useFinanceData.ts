import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Account } from '../../../types/finance';
import {
  loadAccounts,
  loadPaymentAccounts,
  loadVouchers,
  loadVoucherStats,
  loadInvoices,
  loadPartySummaries,
  loadAccountFlows,
  VoucherStats,
  VoucherWithMeta,
  InvoiceWithMeta,
  PartySummaryRow,
  AccountFlowRow
} from '../../../lib/finance';
import { PostVoucherInput } from '../../../lib/finance';
import { FinancialTransaction, PaymentCategory, PaymentMethod } from '../../../types/payment';

/**
 * Central data hook for the Payments hub. Loads accounts + stats once and
 * exposes loaders/refreshers the tabs share, so tab switches don't refetch
 * the chart of accounts and KPIs stay in sync after every mutation.
 */

export const PAGE_SIZE = 25;

/** Category presets mapped to the chart of accounts for the entry form. */
export const CATEGORY_PRESETS: Array<{
  value: number; // account code
  label: string;
  flow: 'in' | 'out';
  legacy?: PaymentCategory;
}> = [
  { value: 3000, label: 'Repair Charges Received', flow: 'in', legacy: 'repair_income' },
  { value: 2100, label: 'Customer Advance Deposit', flow: 'in', legacy: 'advance_payment' },
  { value: 3010, label: 'Spare Parts Sale', flow: 'in', legacy: 'parts_sale' },
  { value: 3020, label: 'General / Other Income', flow: 'in', legacy: 'other_income' },
  { value: 4010, label: 'Market Supplier / Dealer Payment', flow: 'out', legacy: 'market_supplier_payment' },
  { value: 4000, label: 'Inventory / Parts Purchase', flow: 'out', legacy: 'parts_purchase' },
  { value: 4100, label: 'Shop Rent & Utility Bills', flow: 'out', legacy: 'shop_rent_bills' },
  { value: 4200, label: 'Technician Salary / Commission', flow: 'out', legacy: 'technician_salary' },
  { value: 4300, label: 'Tools & Lab Equipment', flow: 'out', legacy: 'tools_equipment' },
  { value: 4400, label: 'Miscellaneous Shop Expense', flow: 'out', legacy: 'miscellaneous_expense' }
];

export interface UseFinanceData {
  accounts: Account[];
  paymentAccounts: Account[];
  stats: VoucherStats | null;
  isLoadingAccounts: boolean;
  refreshStats: () => Promise<void>;
  // voucher list state
  vouchers: VoucherWithMeta[];
  voucherTotal: number;
  voucherPage: number;
  setVoucherPage: (p: number) => void;
  voucherTypeFilter: 'all' | 'receipt' | 'payment';
  setVoucherTypeFilter: (t: 'all' | 'receipt' | 'payment') => void;
  voucherSearch: string;
  setVoucherSearch: (s: string) => void;
  loadVoucherPage: () => Promise<void>;
  isLoadingVouchers: boolean;
  // invoice list state
  invoices: InvoiceWithMeta[];
  invoiceTotal: number;
  invoicePage: number;
  setInvoicePage: (p: number) => void;
  invoiceStatusFilter: string;
  setInvoiceStatusFilter: (s: string) => void;
  invoiceSearch: string;
  setInvoiceSearch: (s: string) => void;
  loadInvoicePage: () => Promise<void>;
  isLoadingInvoices: boolean;
  // party summaries + account flows (loaded on demand by the tabs)
  partySummaries: PartySummaryRow[];
  loadPartySummaries: () => Promise<void>;
  accountFlows: AccountFlowRow[];
  loadAccountFlows: (from?: string, to?: string) => Promise<void>;
  resetAll: () => void;
}

export function useFinanceData(): UseFinanceData {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<VoucherStats | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  // Voucher list
  const [vouchers, setVouchers] = useState<VoucherWithMeta[]>([]);
  const [voucherTotal, setVoucherTotal] = useState(0);
  const [voucherPage, setVoucherPage] = useState(1);
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<'all' | 'receipt' | 'payment'>('all');
  const [voucherSearch, setVoucherSearch] = useState('');
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false);

  // Invoice list
  const [invoices, setInvoices] = useState<InvoiceWithMeta[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // Ledger / reports
  const [partySummaries, setPartySummaries] = useState<PartySummaryRow[]>([]);
  const [accountFlows, setAccountFlows] = useState<AccountFlowRow[]>([]);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await loadVoucherStats());
    } catch (err) {
      console.error('Failed to load voucher stats:', err);
    }
  }, []);

  // Accounts + stats on mount (accounts never change at runtime).
  useEffect(() => {
    (async () => {
      try {
        const [acct, pay] = await Promise.all([loadAccounts(), loadPaymentAccounts()]);
        setAccounts(acct);
        setPaymentAccounts(pay);
      } catch (err) {
        console.error('Failed to load accounts:', err);
        toast.error('Failed to load chart of accounts.');
      } finally {
        setIsLoadingAccounts(false);
      }
      refreshStats();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadVoucherPage = useCallback(async () => {
    setIsLoadingVouchers(true);
    try {
      const { rows, total } = await loadVouchers({
        limit: PAGE_SIZE,
        offset: (voucherPage - 1) * PAGE_SIZE,
        type: voucherTypeFilter,
        search: voucherSearch
      });
      setVouchers(rows);
      setVoucherTotal(total);
    } catch (err) {
      console.error('Failed to load vouchers:', err);
      toast.error('Failed to load vouchers.');
    } finally {
      setIsLoadingVouchers(false);
    }
  }, [voucherPage, voucherTypeFilter, voucherSearch]);

  useEffect(() => {
    loadVoucherPage();
  }, [loadVoucherPage]);

  const loadInvoicePage = useCallback(async () => {
    setIsLoadingInvoices(true);
    try {
      const { rows, total } = await loadInvoices({
        limit: PAGE_SIZE,
        offset: (invoicePage - 1) * PAGE_SIZE,
        status: invoiceStatusFilter,
        search: invoiceSearch
      });
      setInvoices(rows);
      setInvoiceTotal(total);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      toast.error('Failed to load invoices.');
    } finally {
      setIsLoadingInvoices(false);
    }
  }, [invoicePage, invoiceStatusFilter, invoiceSearch]);

  useEffect(() => {
    loadInvoicePage();
  }, [loadInvoicePage]);

  const loadPartySummariesFn = useCallback(async () => {
    try {
      setPartySummaries(await loadPartySummaries());
    } catch (err) {
      console.error('Failed to load party summaries:', err);
      toast.error('Failed to load party ledgers.');
    }
  }, []);

  const loadAccountFlowsFn = useCallback(async (from?: string, to?: string) => {
    try {
      setAccountFlows(await loadAccountFlows(from, to));
    } catch (err) {
      console.error('Failed to load account flows:', err);
      toast.error('Failed to load account flows.');
    }
  }, []);

  const resetAll = useCallback(() => {
    setVoucherPage(1);
    setInvoicePage(1);
    loadVoucherPage();
    loadInvoicePage();
    refreshStats();
  }, [loadVoucherPage, loadInvoicePage, refreshStats]);

  return useMemo(
    () => ({
      accounts,
      paymentAccounts,
      stats,
      isLoadingAccounts,
      refreshStats,
      vouchers,
      voucherTotal,
      voucherPage,
      setVoucherPage,
      voucherTypeFilter,
      setVoucherTypeFilter,
      voucherSearch,
      setVoucherSearch,
      loadVoucherPage,
      isLoadingVouchers,
      invoices,
      invoiceTotal,
      invoicePage,
      setInvoicePage,
      invoiceStatusFilter,
      setInvoiceStatusFilter,
      invoiceSearch,
      setInvoiceSearch,
      loadInvoicePage,
      isLoadingInvoices,
      partySummaries,
      loadPartySummaries: loadPartySummariesFn,
      accountFlows,
      loadAccountFlows: loadAccountFlowsFn,
      resetAll
    }),
    [
      accounts,
      paymentAccounts,
      stats,
      isLoadingAccounts,
      refreshStats,
      vouchers,
      voucherTotal,
      voucherPage,
      voucherTypeFilter,
      voucherSearch,
      loadVoucherPage,
      isLoadingVouchers,
      invoices,
      invoiceTotal,
      invoicePage,
      invoiceStatusFilter,
      invoiceSearch,
      loadInvoicePage,
      isLoadingInvoices,
      partySummaries,
      loadPartySummariesFn,
      accountFlows,
      loadAccountFlowsFn,
      resetAll
    ]
  );
}

// ---------------------------------------------------------------------------
// Legacy row helpers (used while old views still read financial_transactions)
// ---------------------------------------------------------------------------

export function legacyMethodOf(accountCode: number): PaymentMethod {
  switch (accountCode) {
    case 1010:
      return 'bank_transfer';
    case 1020:
      return 'jazzcash';
    case 1030:
      return 'easypaisa';
    default:
      return 'cash';
  }
}

export interface LegacyMirrorRow extends FinancialTransaction {
  _source: 'voucher' | 'legacy';
}

export const flowOfCategory = (code: number): 'in' | 'out' =>
  CATEGORY_PRESETS.find((p) => p.value === code)?.flow ?? 'in';
