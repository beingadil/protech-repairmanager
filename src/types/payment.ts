export type TransactionType = 'credit' | 'debit'; // credit = Money In (Income), debit = Money Out (Expense)

export type PaymentCategory =
  | 'repair_income'
  | 'parts_sale'
  | 'advance_payment'
  | 'other_income'
  | 'parts_purchase'
  | 'market_supplier_payment'
  | 'shop_rent_bills'
  | 'technician_salary'
  | 'tools_equipment'
  | 'miscellaneous_expense';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'jazzcash' | 'easypaisa' | 'other';

export interface FinancialTransaction {
  id: number;
  date: string;
  type: TransactionType; // 'credit' or 'debit'
  amount: number;
  category: PaymentCategory;
  payment_method: PaymentMethod;
  customer_id?: number | null;
  customer_name?: string | null;
  supplier_name?: string | null;
  reference_job_id?: number | null;
  token_number?: string | null;
  description: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MultiEntryRow {
  date: string;
  type: TransactionType;
  amount: number;
  category: PaymentCategory;
  payment_method: PaymentMethod;
  party_name: string;
  description: string;
  reference_token?: string;
  notes?: string;
}

export interface LedgerStats {
  total_credit: number; // Inflow / Income
  total_debit: number;  // Outflow / Expense
  net_balance: number;  // Credit - Debit
  today_credit: number;
  today_debit: number;
  total_entries: number;
}
