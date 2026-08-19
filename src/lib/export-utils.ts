import { Job } from '../types/job';
import { Customer } from '../types/customer';
import { InventoryItem } from '../types/inventory';
import { FinancialTransaction } from '../types/payment';

export function exportFinancialTransactionsToCSV(transactions: FinancialTransaction[]): void {
  const headers = [
    'ID',
    'Date',
    'Type',
    'Amount (PKR)',
    'Category',
    'Payment Method',
    'Customer Name',
    'Supplier Name',
    'Token Number',
    'Description',
    'Notes'
  ];

  const rows = transactions.map((t) => [
    t.id,
    `"${t.date || ''}"`,
    `"${t.type.toUpperCase()}"`,
    t.amount || 0,
    `"${t.category || ''}"`,
    `"${t.payment_method || ''}"`,
    `"${t.customer_name || ''}"`,
    `"${t.supplier_name || ''}"`,
    `"${t.token_number || ''}"`,
    `"${(t.description || '').replace(/"/g, '""')}"`,
    `"${(t.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ProTech_Ledger_Report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportJobsToCSV(jobs: Job[]): void {
  const headers = [
    'Token Number',
    'Customer Name',
    'Customer Phone',
    'Type',
    'Model',
    'Serial No',
    'Receive Date',
    'Return Date',
    'Charges (PKR)',
    'Payment Status',
    'Delivery Status',
    'Has Charger',
    'Symptoms'
  ];

  const rows = jobs.map((j) => [
    `"${j.token_number || ''}"`,
    `"${j.customer_name || ''}"`,
    `"${j.customer_mobile || ''}"`,
    `"${j.job_type || ''}"`,
    `"${j.model || ''}"`,
    `"${j.serial_no || ''}"`,
    `"${j.receive_date || ''}"`,
    `"${j.return_date || ''}"`,
    j.charges || 0,
    `"${j.payment_status || ''}"`,
    `"${j.deliver_status || ''}"`,
    j.has_charger ? 'Yes' : 'No',
    `"${(j.symptoms || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ProData_Jobs_Report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportCustomersToCSV(customers: Customer[]): void {
  const headers = ['ID', 'Name', 'Mobile', 'Address', 'Total Repairs', 'Total Spent (PKR)', 'Created At'];

  const rows = customers.map((c) => [
    c.id,
    `"${c.name || ''}"`,
    `"${c.mobile || ''}"`,
    `"${c.address || ''}"`,
    c.total_jobs || 0,
    c.total_spent || 0,
    `"${c.created_at || ''}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ProData_Customers_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportInventoryToCSV(items: InventoryItem[]): void {
  const headers = [
    'Part Number',
    'Item Name',
    'Category',
    'Current Stock Qty',
    'Min Threshold',
    'Unit Cost (PKR)',
    'Selling Price (PKR)',
    'Total Cost Value',
    'Total Retail Value',
    'Shelf Location',
    'Supplier Info',
    'Notes'
  ];

  const rows = items.map((i) => [
    `"${i.part_number || ''}"`,
    `"${i.name || ''}"`,
    `"${i.category || ''}"`,
    i.quantity || 0,
    i.min_threshold || 0,
    i.unit_cost || 0,
    i.selling_price || 0,
    (i.quantity || 0) * (i.unit_cost || 0),
    (i.quantity || 0) * (i.selling_price || 0),
    `"${i.location || ''}"`,
    `"${i.supplier_info || ''}"`,
    `"${(i.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ProTech_Stock_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const exportLedgerToCSV = exportFinancialTransactionsToCSV;

