-- Shared IPv4 registry for TG-bot + web billing (PostgreSQL)
CREATE TABLE IF NOT EXISTS network_ip_allocations (
  id SERIAL PRIMARY KEY,
  ip VARCHAR(15) NOT NULL UNIQUE,
  network VARCHAR(43) NOT NULL,
  owner VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'reserved',
  vmid INTEGER NULL,
  "externalServiceId" VARCHAR(64) NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "releasedAt" TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS idx_network_ip_allocations_network ON network_ip_allocations (network);
CREATE INDEX IF NOT EXISTS idx_network_ip_allocations_vmid ON network_ip_allocations (vmid);
