-- Migration 003: Performance Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_search ON jobs(token_number, serial_no, model);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers(name, mobile);
