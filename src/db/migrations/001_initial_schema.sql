-- Migration 001: Initial Schema
-- Table: customers
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mobile TEXT,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Table: jobs
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_number TEXT NOT NULL UNIQUE, -- e.g. TK-1042
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  job_type TEXT NOT NULL DEFAULT 'laptop', -- 'laptop' | 'pc'
  serial_no TEXT,
  model TEXT,
  ram TEXT,
  hard TEXT,
  processor TEXT,
  symptoms TEXT,
  receive_date TEXT NOT NULL,
  return_date TEXT,
  charges REAL DEFAULT 0,
  has_charger INTEGER NOT NULL DEFAULT 0, -- 0 = No, 1 = Yes
  payment_status TEXT NOT NULL DEFAULT 'due', -- 'paid' | 'due'
  deliver_status TEXT NOT NULL DEFAULT 'pending', -- 'delivered' | 'pending'
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT -- NULL = active
);

CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_token ON jobs(token_number);
CREATE INDEX IF NOT EXISTS idx_jobs_receive_date ON jobs(receive_date);
CREATE INDEX IF NOT EXISTS idx_jobs_payment ON jobs(payment_status);
CREATE INDEX IF NOT EXISTS idx_jobs_deliver ON jobs(deliver_status);
CREATE INDEX IF NOT EXISTS idx_jobs_deleted ON jobs(deleted_at);

-- Table: job_notifications
CREATE TABLE IF NOT EXISTS job_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  channel TEXT NOT NULL, -- 'whatsapp' | 'sms'
  message TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'sent' -- 'sent' | 'failed'
);

-- Table: backup_log
CREATE TABLE IF NOT EXISTS backup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size_bytes INTEGER,
  backup_type TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'auto'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Table: settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
