-- PostgreSQL: reseller API wallet ledger
CREATE TABLE IF NOT EXISTS reseller_wallet_transactions (
  id SERIAL PRIMARY KEY,
  "resellerId" VARCHAR(64) NOT NULL,
  "amountUsd" REAL NOT NULL,
  "balanceAfterUsd" REAL NOT NULL,
  type VARCHAR(32) NOT NULL,
  "serviceId" INTEGER,
  vmid INTEGER,
  detail VARCHAR(256),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reseller_wallet_reseller ON reseller_wallet_transactions ("resellerId");
