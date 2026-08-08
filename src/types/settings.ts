export interface AppSettings {
  shop_name: string;
  shop_address: string;
  shop_mobile: string;
  logo_path: string;
  theme: 'dark' | 'light';
  thermal_size: '58' | '80';
  default_charges: string;
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
