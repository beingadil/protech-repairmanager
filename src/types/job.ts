export type JobType = 'laptop' | 'pc';
export type PaymentStatus = 'paid' | 'due';
export type DeliverStatus = 'pending' | 'in_progress' | 'in_diagnostics' | 'ready' | 'delivered';

export interface Job {
  id: number;
  token_number: string;
  customer_id: number;
  customer_name?: string;
  customer_mobile?: string;
  customer_address?: string;
  job_type: JobType;
  serial_no: string;
  model: string;
  ram: string;
  hard: string;
  processor: string;
  symptoms: string;
  receive_date: string;
  return_date: string;
  charges: number;
  has_charger: number; // 0 = No, 1 = Yes
  payment_status: PaymentStatus;
  deliver_status: DeliverStatus;
  notes: string;
  reference_token?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateJobInput {
  customer_id?: number;
  customer_name: string;
  customer_mobile: string;
  customer_address?: string;
  job_type: JobType;
  serial_no: string;
  model: string;
  ram: string;
  hard: string;
  processor: string;
  symptoms: string;
  receive_date: string;
  return_date: string;
  charges: number;
  has_charger: number;
  payment_status: PaymentStatus;
  deliver_status: DeliverStatus;
  notes?: string;
  reference_token?: string | null;
}

export interface JobNotification {
  id: number;
  job_id: number;
  channel: 'whatsapp' | 'sms';
  message: string;
  sent_at: string;
  status: 'sent' | 'failed';
}

export interface JobFilter {
  search?: string;
  payment_status?: 'all' | PaymentStatus;
  deliver_status?: 'all' | DeliverStatus;
  job_type?: 'all' | JobType;
  date_from?: string;
  date_to?: string;
}
