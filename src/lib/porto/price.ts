/**
 * Relay Price API Integration
 *
 * Handles USD ↔ crypto conversions using Relay's price API.
 * Includes caching to minimize API calls.
 *
 * @see https://docs.relay.link/references/api/get-token-price
 */

import type {
  RelayPriceParams,
  RelayPriceResponse,
  PriceCacheEntry,
  PriceValidation,
  ParsedPayment,
  ResolvedPayment,
  PaymentResolutionOptions,
  TokenConfig,
} from "./types";
import { formatWeiToDisplay, parseAmountToWei } from "./eip681";

/**
 * Relay Price API base URL
 */
const RELAY_PRICE_API = "https://api.relay.link";

/**
 * Price cache TTL in milliseconds (30 seconds)
 */
const PRICE_CACHE_TTL = 30 * 1000;

/**
 * Price cache
 */
const priceCache = new Map<string, PriceCacheEntry>();

/**
 * Well-known token configurations by address (lowercase)
 */
const KNOWN_TOKENS: Record<string, TokenConfig> = {
  // Native ETH (zero address convention)
  "0x0000000000000000000000000000000000000000": {
    symbol: "ETH",
    decimals: 18,
    isStablecoin: false,
  },
  // USDC on Ethereum
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
    symbol: "USDC",
    decimals: 6,
    isStablecoin: true,
  },
  // USDT on Ethereum
  "0xdac17f958d2ee523a2206206994597c13d831ec7": {
    symbol: "USDT",
    decimals: 6,
    isStablecoin: true,
  },
  // DAI on Ethereum
  "0x6b175474e89094c44da98b954eedeac495271d0f": {
    symbol: "DAI",
    decimals: 18,
    isStablecoin: true,
  },
  // USDC on Base
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": {
    symbol: "USDC",
    decimals: 6,
    isStablecoin: true,
  },
  // USDC on Polygon
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": {
    symbol: "USDC",
    decimals: 6,
    isStablecoin: true,
  },
  // USDC.e on Polygon (bridged)
  "0x2791bca1f2de4661ed88a30c99a7a9449aa84174": {
    symbol: "USDC.e",
    decimals: 6,
    isStablecoin: true,
  },
  // USDC on Arbitrum
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": {
    symbol: "USDC",
    decimals: 6,
    isStablecoin: true,
  },
  // USDC on Optimism
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85": {
    symbol: "USDC",
    decimals: 6,
    isStablecoin: true,
  },
};

/**
 * Generate cache key for price lookup
 */
function getCacheKey(params: RelayPriceParams): string {
  return `${params.currency.toLowerCase()}-${params.chainId}-${params.toCurrency || "usd"}`;
}

/**
 * Get cached price if still valid
 */
function getCachedPrice(params: RelayPriceParams): number | null {
  const key = getCacheKey(params);
  const cached = priceCache.get(key);

  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > PRICE_CACHE_TTL) {
    priceCache.delete(key);
    return null;
  }

  return cached.price;
}

/**
 * Cache a price
 */
function setCachedPrice(params: RelayPriceParams, price: number): void {
  const key = getCacheKey(params);
  priceCache.set(key, {
    price,
    timestamp: Date.now(),
  });
}

/**
 * Clear the price cache (useful for testing)
 */
export function clearPriceCache(): void {
  priceCache.clear();
}

/**
 * Get token address for price lookup
 *
 * For native tokens, returns the zero address.
 * For symbol lookups (eth, matic, etc.), returns appropriate address.
 */
function resolveTokenAddress(currency: string, chainId: number): string {
  const lowered = currency.toLowerCase();

  // Handle native token symbols
  if (lowered === "eth" || lowered === "matic" || lowered === "bnb" || lowered === "avax") {
    // Zero address represents native token
    return "0x0000000000000000000000000000000000000000";
  }

  // If it's already an address, return as-is
  if (currency.startsWith("0x") && currency.length === 42) {
    return currency;
  }

  // Default to zero address for unknown symbols
  return "0x0000000000000000000000000000000000000000";
}

/**
 * Fetch token price from Relay API
 *
 * Uses the Relay API endpoint: /currencies/token/price
 *
 * @param params - Price request parameters
 * @returns Price in USD
 * @throws Error if price fetch fails
 */
export async function getTokenPrice(params: RelayPriceParams): Promise<number> {
  // Check cache first
  const cached = getCachedPrice(params);
  if (cached !== null) {
    return cached;
  }

  // Resolve token address
  const address = resolveTokenAddress(params.currency, params.chainId);

  // Build URL with correct Relay API endpoint
  const url = new URL(`${RELAY_PRICE_API}/currencies/token/price`);
  url.searchParams.set("address", address);
  url.searchParams.set("chainId", params.chainId.toString());

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || error.error || `Failed to fetch price: ${response.status}`
    );
  }

  const data: RelayPriceResponse = await response.json();
  const price = parseFloat(data.price);

  if (isNaN(price) || price <= 0) {
    throw new Error(`Invalid price received: ${data.price}`);
  }

  // Cache the result
  setCachedPrice(params, price);

  return price;
}

/**
 * Get native token price for a chain
 *
 * @param chainId - Chain ID
 * @returns Price in USD
 */
export async function getNativeTokenPrice(chainId: number): Promise<number> {
  // Use "eth" for Ethereum-like chains, adjust for others as needed
  const currency =
    chainId === 137
      ? "matic"
      : chainId === 43114
        ? "avax"
        : chainId === 56
          ? "bnb"
          : "eth";

  return getTokenPrice({
    currency,
    chainId,
    toCurrency: "usd",
  });
}

/**
 * Convert USD to wei
 *
 * @param usdAmount - USD amount as string
 * @param tokenPrice - Token price in USD
 * @param decimals - Token decimals (default 18)
 * @returns Wei amount as string
 */
export function convertUSDToWei(
  usdAmount: string,
  tokenPrice: number,
  decimals = 18
): string {
  const usd = parseFloat(usdAmount);
  if (isNaN(usd) || usd <= 0) {
    throw new Error(`Invalid USD amount: ${usdAmount}`);
  }

  // Calculate token amount
  const tokenAmount = usd / tokenPrice;

  // Convert to wei with proper precision
  // Use string manipulation to avoid floating point errors
  const [intPart, decPart = ""] = tokenAmount.toString().split(".");
  const paddedDecimal = decPart.padEnd(decimals, "0").slice(0, decimals);
  const combined = intPart + paddedDecimal;

  // Remove leading zeros
  return combined.replace(/^0+/, "") || "0";
}

/**
 * Convert wei to USD
 *
 * @param wei - Wei amount as string
 * @param tokenPrice - Token price in USD
 * @param decimals - Token decimals (default 18)
 * @returns USD amount formatted to 2 decimal places
 */
export function convertWeiToUSD(
  wei: string,
  tokenPrice: number,
  decimals = 18
): string {
  const tokenAmount = formatWeiToDisplay(wei, decimals);
  const usdAmount = parseFloat(tokenAmount) * tokenPrice;

  if (isNaN(usdAmount)) {
    return "0.00";
  }

  return usdAmount.toFixed(2);
}

/**
 * Validate that provided value and usdAmount match current rates
 *
 * @param providedWei - Wei amount from payment
 * @param providedUSD - USD amount from payment
 * @param currentPrice - Current token price in USD
 * @param decimals - Token decimals
 * @returns Validation result with discrepancy if applicable
 */
export function validateConversion(
  providedWei: string,
  providedUSD: string,
  currentPrice: number,
  decimals = 18
): PriceValidation {
  const tokenAmount = parseFloat(formatWeiToDisplay(providedWei, decimals));
  const providedUsdNum = parseFloat(providedUSD);

  if (isNaN(tokenAmount) || isNaN(providedUsdNum)) {
    return {
      valid: false,
      message: "Invalid amount format",
    };
  }

  // Calculate expected USD from wei
  const expectedUSD = tokenAmount * currentPrice;

  // Calculate discrepancy percentage
  const discrepancy = Math.abs(expectedUSD - providedUsdNum) / providedUsdNum;

  if (discrepancy > 0.05) {
    // More than 5% difference
    return {
      valid: false,
      discrepancy,
      message: `Price mismatch: provided $${providedUSD} but current rate gives $${expectedUSD.toFixed(2)} (${(discrepancy * 100).toFixed(1)}% difference)`,
    };
  }

  return {
    valid: true,
    discrepancy,
  };
}

/**
 * Get token configuration
 *
 * @param address - Token address (or undefined for native)
 * @param chainId - Chain ID
 * @returns Token configuration with defaults
 */
export function getTokenConfig(
  address: string | undefined,
  chainId: number
): TokenConfig {
  // Native token
  if (!address || address === "0x0000000000000000000000000000000000000000") {
    // Determine native token based on chain
    if (chainId === 137) {
      return { symbol: "MATIC", decimals: 18, isStablecoin: false };
    }
    if (chainId === 56) {
      return { symbol: "BNB", decimals: 18, isStablecoin: false };
    }
    if (chainId === 43114) {
      return { symbol: "AVAX", decimals: 18, isStablecoin: false };
    }
    return { symbol: "ETH", decimals: 18, isStablecoin: false };
  }

  // Look up known token
  const knownToken = KNOWN_TOKENS[address.toLowerCase()];
  if (knownToken) {
    return knownToken;
  }

  // Default for unknown ERC-20 (most use 18 decimals)
  return { symbol: "TOKEN", decimals: 18, isStablecoin: false };
}

/**
 * Resolve a parsed payment with price data
 *
 * Handles three cases:
 * 1. Only value provided: Calculate USD equivalent
 * 2. Only usdAmount provided: Calculate crypto value from current rate
 * 3. Both provided: Use crypto value, validate against USD
 *
 * @param payment - Parsed payment from EIP-681
 * @param options - Resolution options
 * @returns Resolved payment with calculated amounts
 */
export async function resolvePaymentAmount(
  payment: ParsedPayment,
  options: PaymentResolutionOptions = {}
): Promise<ResolvedPayment> {
  const { maxDiscrepancy = 0.05, throwOnPriceFailure = true } = options;

  // Get token configuration
  const tokenConfig = getTokenConfig(
    payment.isERC20 ? payment.tokenAddress : undefined,
    payment.chainId
  );

  // Determine currency for price lookup
  const currency = payment.isERC20
    ? payment.tokenAddress!
    : payment.chainId === 137
      ? "matic"
      : payment.chainId === 56
        ? "bnb"
        : payment.chainId === 43114
          ? "avax"
          : "eth";

  let tokenPrice: number;
  let priceCalculated = false;
  let priceWarning: string | undefined;

  // Fetch price
  try {
    tokenPrice = await getTokenPrice({
      currency,
      chainId: payment.chainId,
      toCurrency: "usd",
    });
  } catch (error) {
    if (throwOnPriceFailure) {
      throw error;
    }
    // Fallback: use 1:1 for stablecoins, throw for others
    if (tokenConfig.isStablecoin) {
      tokenPrice = 1;
      priceWarning = "Price fetch failed, using 1:1 rate for stablecoin";
    } else {
      throw new Error(
        `Cannot resolve payment: price fetch failed and token is not a stablecoin`
      );
    }
  }

  let resolvedValue: string;
  let resolvedUsdAmount: string;

  if (payment.value && payment.usdAmount) {
    // Case 3: Both provided - use crypto value, validate against USD
    resolvedValue = payment.value;
    resolvedUsdAmount = payment.usdAmount;

    const validation = validateConversion(
      payment.value,
      payment.usdAmount,
      tokenPrice,
      tokenConfig.decimals
    );

    if (!validation.valid && validation.discrepancy! > maxDiscrepancy) {
      priceWarning = validation.message;
    }
  } else if (payment.usdAmount) {
    // Case 2: Only USD provided - calculate crypto from current rate
    priceCalculated = true;
    resolvedUsdAmount = payment.usdAmount;
    resolvedValue = convertUSDToWei(
      payment.usdAmount,
      tokenPrice,
      tokenConfig.decimals
    );
    priceWarning =
      "Amount calculated at current exchange rate - price may fluctuate";
  } else if (payment.value) {
    // Case 1: Only value provided - calculate USD equivalent
    resolvedValue = payment.value;
    resolvedUsdAmount = convertWeiToUSD(
      payment.value,
      tokenPrice,
      tokenConfig.decimals
    );
  } else {
    // No amount specified - return zeros
    resolvedValue = "0";
    resolvedUsdAmount = "0.00";
    priceWarning = "No amount specified in payment request";
  }

  return {
    ...payment,
    resolvedValue,
    resolvedUsdAmount,
    tokenPrice,
    priceCalculated,
    priceWarning,
    decimals: tokenConfig.decimals,
    symbol: tokenConfig.symbol,
  };
}

/**
 * Format price display string
 *
 * @param usdAmount - USD amount
 * @param cryptoAmount - Crypto amount (human readable)
 * @param symbol - Token symbol
 * @returns Formatted string like "$25.00 (~0.0083 ETH)"
 */
export function formatPriceDisplay(
  usdAmount: string,
  cryptoAmount: string,
  symbol: string
): string {
  return `$${usdAmount} (~${cryptoAmount} ${symbol})`;
}

/**
 * Format current exchange rate
 *
 * @param price - Token price in USD
 * @param symbol - Token symbol
 * @returns Formatted string like "1 ETH = $3,000.45"
 */
export function formatExchangeRate(price: number, symbol: string): string {
  return `1 ${symbol} = $${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
