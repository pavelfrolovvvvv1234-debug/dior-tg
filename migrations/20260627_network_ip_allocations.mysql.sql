-- Shared IPv4 registry for TG-bot + web billing (MySQL / MariaDB)
CREATE TABLE IF NOT EXISTS network_ip_allocations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(15) NOT NULL,
  network VARCHAR(43) NOT NULL,
  owner VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'reserved',
  vmid INT NULL,
  externalServiceId VARCHAR(64) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  releasedAt DATETIME NULL,
  UNIQUE KEY uq_network_ip_allocations_ip (ip),
  KEY idx_network_ip_allocations_network (network),
  KEY idx_network_ip_allocations_vmid (vmid)
) ENGINE=InnoDB;
