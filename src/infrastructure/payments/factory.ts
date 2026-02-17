/**
 * Payment provider factory.
 *
 * @module infrastructure/payments/factory
 */

import type { IPaymentProvider, PaymentProviderName } from "./types";
import { CrystalPayProvider } from "./crystalpay";
import { CryptoBotProvider } from "./cryptobot";

/**
 * Create a payment provider instance by name.
 *
 * @param name - Provider name
 * @returns Payment provider instance
 * @throws {Error} If provider name is invalid
 */
export function createPaymentProvider(name: PaymentProviderName): IPaymentProvider {
  switch (name) {
    case "crystalpay":
      return new CrystalPayProvider();
    case "cryptobot":
      return new CryptoBotProvider();
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
  return [new CrystalPayProvider(), new CryptoBotProvider()];
}
