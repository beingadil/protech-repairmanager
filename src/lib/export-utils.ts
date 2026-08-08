import { Job } from '../types/job';
import { Customer } from '../types/customer';

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
