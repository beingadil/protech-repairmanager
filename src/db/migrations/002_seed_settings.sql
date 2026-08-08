-- Migration 002: Seed default settings (ProTech Services)
INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_name', 'ProTech Services');
INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_address', 'Jamil Ahmad Computer Market, Munir Chowk, Gujranwala / Flat 1, Sadiq Plaza, Lahore');
INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_mobile', '0300-0404004');
INSERT OR IGNORE INTO settings (key, value) VALUES ('logo_path', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark');
INSERT OR IGNORE INTO settings (key, value) VALUES ('thermal_size', '80');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_charges', '1500');
INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_backup', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('token_counter', '1000');
