import { create } from 'zustand';
import { Customer } from '../types/customer';

interface CustomersState {
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
}

// Caches the customer/supplier directory so reopening the module paints
// instantly from cache while the latest aggregate query runs in background.
export const useCustomersStore = create<CustomersState>((set) => ({
  customers: [],
  setCustomers: (customers) => set({ customers })
}));
