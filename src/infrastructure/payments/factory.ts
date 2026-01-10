/**
 * Payment provider factory.
 *
 * @module infrastructure/payments/factory
 */

import type { IPaymentProvider, PaymentProviderName } from "./types.js";
import { AAIOProvider } from "./aaio.js";
import { CrystalPayProvider } from "./crystalpay.js";

/**
 * Create a payment provider instance by name.
 *
 * @param name - Provider name
 * @returns Payment provider instance
 * @throws {Error} If provider name is invalid
 */
export function createPaymentProvider(name: PaymentProviderName): IPaymentProvider {
  switch (name) {
    case "aaio":
      return new AAIOProvider();
    case "crystalpay":
      return new CrystalPayProvider();
    default:
      throw new Error(`Unknown payment provider: ${name}`);
  }
}

/**
 * Get all available payment providers.
 *
 * @returns Array of payment provider instances
 */
export function getAllPaymentProviders(): IPaymentProvider[] {
  return [new AAIOProvider(), new CrystalPayProvider()];
}
