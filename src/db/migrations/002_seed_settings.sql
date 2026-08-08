-- Migration 002: Seed default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_name', 'ProData System');
INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_address', 'Main Service Center, Plaza Street, City');
INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_mobile', '+92 300 1234567');
INSERT OR IGNORE INTO settings (key, value) VALUES ('logo_path', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark');
INSERT OR IGNORE INTO settings (key, value) VALUES ('thermal_size', '80');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_charges', '1500');
INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_backup', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('token_counter', '1000');
