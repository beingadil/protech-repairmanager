export type InventoryCategory =
  | 'RAM'
  | 'Storage (SSD/HDD)'
  | 'LCD Displays'
  | 'Batteries'
  | 'Keyboards'
  | 'IC / Motherboard'
  | 'Chargers & Power'
  | 'Cooling & Paste'
  | 'Accessories & Cables'
  | 'Other';

export interface InventoryItem {
  id: number;
  part_number: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  min_threshold: number;
  unit_cost: number;
  selling_price: number;
  location: string;
  supplier_info?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: number;
  item_id: number;
  item_name?: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity_changed: number;
  unit_cost?: number;
  job_id?: number;
  job_token?: string;
  notes?: string;
  created_at: string;
}

export interface InventoryStats {
  total_items: number;
  total_quantity: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_cost_value: number;
  total_retail_value: number;
}
