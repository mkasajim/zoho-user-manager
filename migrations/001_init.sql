-- migrations/001_init.sql
-- Schema for zoho-user-manager on Cloudflare D1

-- Admin sessions table
CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname TEXT NOT NULL,
  os TEXT,
  arch TEXT,
  cpu TEXT,
  mac_address TEXT,
  disk_serial TEXT,
  system_uuid TEXT,
  motherboard_serial TEXT,
  cpu_id TEXT,
  is_blocked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_signin TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes to enforce uniqueness and speed lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_system_uuid ON devices (system_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_mac_address ON devices (mac_address);
