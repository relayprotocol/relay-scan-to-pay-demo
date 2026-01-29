/**
 * Porto Scan-to-Pay Module
 *
 * Self-contained module for EIP-681 payment parsing and processing
 * with USD amount support via Relay Price API.
 */

// Types
export type {
  ParsedPayment,
  ResolvedPayment,
  RelayPriceParams,
  RelayPriceResponse,
  PriceCacheEntry,
  PriceValidation,
  PaymentResolutionOptions,
  TokenConfig,
  ChainConfig,
} from "./types";

// EIP-681 Parser
export {
  parseEIP681,
  validatePayment,
  isValidAddress,
  parseScientificNotation,
  formatWeiToDisplay,
  parseAmountToWei,
  buildEIP681URI,
} from "./eip681";

// Price API
export {
  getTokenPrice,
  getNativeTokenPrice,
  convertUSDToWei,
  convertWeiToUSD,
  validateConversion,
  getTokenConfig,
  resolvePaymentAmount,
  formatPriceDisplay,
  formatExchangeRate,
  clearPriceCache,
} from "./price";
