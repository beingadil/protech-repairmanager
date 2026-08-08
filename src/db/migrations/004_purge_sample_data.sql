-- Migration 004: Purge legacy sample data and mark as seeded
DELETE FROM job_notifications WHERE job_id IN (SELECT id FROM jobs WHERE token_number IN ('TK-1001', 'TK-1002', 'TK-1003', 'TK-1004', 'TK-1005'));
DELETE FROM jobs WHERE token_number IN ('TK-1001', 'TK-1002', 'TK-1003', 'TK-1004', 'TK-1005');
DELETE FROM customers WHERE name IN ('Ahmad Hassan', 'Bilal Tariq', 'Usman Khalid', 'Zainab Raza', 'Kamran Ali');
-- Remove dead Twilio settings (feature removed; plaintext secrets must not linger)
DELETE FROM settings WHERE key IN ('twilio_sid', 'twilio_token', 'twilio_from');
INSERT OR REPLACE INTO settings (key, value) VALUES ('has_seeded', '1');
