/**
 * Preset option lists shared across forms.
 * Values are stored verbatim in the database — new entries must not
 * break existing rows, so schemas treat these fields as open strings.
 */

export interface DropdownOption {
  value: string;
  label: string;
}

/** Matches JobType = 'laptop' | 'pc'. */
export const DEVICE_TYPES: DropdownOption[] = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'pc', label: 'Desktop PC' },
];

export const BRANDS: DropdownOption[] = [
  'Dell', 'HP', 'Lenovo', 'Apple (MacBook)', 'Asus', 'Acer', 'MSI',
  'Toshiba', 'Samsung', 'Microsoft Surface', 'Gigabyte', 'Razer',
  'Custom Build',
].map((b) => ({ value: b, label: b }));

export const RAM_OPTIONS: DropdownOption[] = [
  '2GB DDR3', '4GB DDR3', '4GB DDR4', '8GB DDR3', '8GB DDR4',
  '12GB DDR4', '16GB DDR4', '16GB DDR5', '32GB DDR4', '32GB DDR5',
  '64GB DDR5',
].map((r) => ({ value: r, label: r }));

export const STORAGE_OPTIONS: DropdownOption[] = [
  '128GB SSD', '256GB SSD', '512GB SSD', '1TB SSD', '2TB SSD',
  '500GB HDD', '1TB HDD', '2TB HDD',
  '256GB SSD + 1TB HDD', '512GB SSD + 1TB HDD', '1TB SSD + 1TB HDD',
].map((s) => ({ value: s, label: s }));

export const PROCESSOR_OPTIONS: DropdownOption[] = [
  'Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9',
  'Intel Core Ultra 5', 'Intel Core Ultra 7', 'Intel Core Ultra 9',
  'Intel Celeron', 'Intel Pentium', 'Intel Xeon',
  'AMD Ryzen 3', 'AMD Ryzen 5', 'AMD Ryzen 7', 'AMD Ryzen 9',
  'Apple M1', 'Apple M2', 'Apple M3', 'Apple M4',
].map((p) => ({ value: p, label: p }));

/** Common laptop/desktop model names offered as quick picks. */
export const MODEL_SUGGESTIONS: string[] = [
  'Dell XPS 15', 'Dell Latitude 5420', 'HP Pavilion', 'HP EliteBook 840',
  'Lenovo ThinkPad T480', 'MacBook Pro 14"', 'MacBook Air M2',
  'Asus VivoBook', 'Acer Aspire 5', 'Custom Desktop',
];

/** UI labels for PaymentStatus values ('paid' | 'due' | 'complimentary'). */
export const PAYMENT_STATUS_OPTIONS: DropdownOption[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'due', label: 'Due' },
  { value: 'complimentary', label: 'Complimentary' },
];

/** UI labels for DeliverStatus values. */
export const DELIVER_STATUS_OPTIONS: DropdownOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_diagnostics', label: 'In Diagnostics' },
  { value: 'ready', label: 'Ready for Pickup' },
  { value: 'delivered', label: 'Delivered' },
];
