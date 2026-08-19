import { Job } from './job';

export type PartyType = 'customer' | 'supplier';

export interface Customer {
  id: number;
  name: string;
  mobile: string;
  address: string;
  party_type: PartyType; // 'customer' or 'supplier'
  created_at: string;
  updated_at: string;
  total_jobs?: number;
  pending_jobs?: number;
  delivered_jobs?: number;
  total_billed?: number;
  total_spent?: number;
  total_paid?: number;
  balance_due?: number;
  jobs?: Job[];
}

export interface CustomerInput {
  name: string;
  mobile: string;
  address?: string;
  party_type?: PartyType;
}
