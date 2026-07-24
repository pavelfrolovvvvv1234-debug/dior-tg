/**
 * Factory for AmperDomainService from env + DataSource.
 *
 * @module helpers/create-amper-domain-service
 */

import type { DataSource } from "typeorm";
import { AmperDomainService } from "../domain/services/AmperDomainService.js";
import { BillingService } from "../domain/billing/BillingService.js";
import { DomainRepository } from "../infrastructure/db/repositories/DomainRepository.js";
import { UserRepository } from "../infrastructure/db/repositories/UserRepository.js";
import { TopUpRepository } from "../infrastructure/db/repositories/TopUpRepository.js";
import { AmperDomainsProvider } from "../infrastructure/domains/AmperDomainsProvider.js";

export function isAmperApiConfigured(): boolean {
  return Boolean(process.env.AMPER_API_BASE_URL?.trim() && process.env.AMPER_API_TOKEN?.trim());
}

export function createAmperDomainService(dataSource: DataSource): AmperDomainService {
  const domainRepo = new DomainRepository(dataSource);
  const userRepo = new UserRepository(dataSource);
  const topUpRepo = new TopUpRepository(dataSource);
  const billingService = new BillingService(dataSource, userRepo, topUpRepo);
  const provider = new AmperDomainsProvider({
    apiBaseUrl: process.env.AMPER_API_BASE_URL || "",
    apiToken: process.env.AMPER_API_TOKEN || "",
    timeoutMs: parseInt(process.env.AMPER_API_TIMEOUT_MS || "8000", 10),
    defaultNs1: process.env.DEFAULT_NS1,
    defaultNs2: process.env.DEFAULT_NS2,
  });
  return new AmperDomainService(dataSource, domainRepo, billingService, provider);
}
