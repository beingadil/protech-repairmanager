export interface AppSettings {
  shop_name: string;
  shop_slogan?: string;
  shop_address: string;
  shop_mobile: string;
  shop_whatsapp?: string;
  shop_email?: string;
  logo_path: string;
  theme: 'dark' | 'light';
  thermal_size: '58' | '80' | 'a4';
  default_charges: string;
  currency_symbol?: string;
  receipt_header_msg?: string;
  receipt_footer_msg?: string;
  receipt_terms?: string;
  show_qr_on_receipt?: '0' | '1';
  show_logo_on_receipt?: '0' | '1';
  default_warranty_days?: string;
  default_turnaround_days?: string;
  token_prefix?: string;
  twilio_sid: string;
  twilio_token: string;
  twilio_from: string;
  auto_backup: '0' | '1';
  token_counter: string;
}

export interface DashboardStats {
  total_jobs: number;
  active_jobs: number;
  delivered_jobs: number;
  revenue_total: number;
  today_jobs: number;
  overdue_jobs_count: number;
}

export interface BackupLogItem {
  id: number;
  file_path: string;
  file_name: string;
  size_bytes: number;
  backup_type: 'manual' | 'auto';
  created_at: string;
}
