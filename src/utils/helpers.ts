import { getCloudflareContext } from '@opennextjs/cloudflare';

// Get Cloudflare context in async mode
export async function getEnv() {
  const cfContext = await getCloudflareContext({ async: true });
  return cfContext
    ? {
        ...cfContext.env,
        NODE_ENV: process.env.NODE_ENV, // Ensure NODE_ENV is available
      }
    : process.env;
}

/**
 * Convert cents to display currency (EUR/USD)
 * @param centsValue - Price in cents as stored in database
 * @returns Price in currency units (e.g., EUR)
 */
export function centsToDisplayCurrency(centsValue: number): number {
  return centsValue / 100;
}

/**
 * Convert display currency (EUR/USD) to cents for database storage
 * @param currencyValue - Price in currency units (e.g., EUR)
 * @returns Price in cents for database storage
 */
export function displayCurrencyToCents(currencyValue: number): number {
  return Math.round(currencyValue * 100);
}
