import { Job } from './job';

export interface Customer {
  id: number;
  name: string;
  mobile: string;
  address: string;
  created_at: string;
  updated_at: string;
  total_jobs?: number;
  total_spent?: number;
  jobs?: Job[];
}

export interface CustomerInput {
  name: string;
  mobile: string;
  address?: string;
}
