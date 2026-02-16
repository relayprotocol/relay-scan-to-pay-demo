/**
 * Wallet Module
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
  Transaction,
  PageView,
  ScannerState,
  PaymentCurrency,
  PaymentFlowState,
} from "./types";

// Constants
export {
  ARBITRUM_USDC,
  ERC20_ABI,
  CHAIN_NAMES,
  SUPPORTED_CHAINS,
  SUPPORTED_CHAIN_IDS,
  EXPLORER_URLS,
  SUPPORTED_TOKENS,
  NATIVE_TOKEN_ADDRESS,
} from "./constants";

// Utils
export { parseWalletError, getExplorerUrl, getTokenExplorerUrl } from "./utils";

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
