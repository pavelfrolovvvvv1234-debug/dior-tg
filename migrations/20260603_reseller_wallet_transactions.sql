-- Reseller API wallet ledger (SQLite / PostgreSQL compatible)
CREATE TABLE IF NOT EXISTS reseller_wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resellerId VARCHAR(64) NOT NULL,
  amountUsd REAL NOT NULL,
  balanceAfterUsd REAL NOT NULL,
  type VARCHAR(32) NOT NULL,
  serviceId INTEGER,
  vmid INTEGER,
  detail VARCHAR(256),
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reseller_wallet_reseller ON reseller_wallet_transactions (resellerId);
