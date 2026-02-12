/**
 * Scan-to-Pay Types
 *
 * Types for EIP-681 parsing and payment processing with USD amount support.
 */

/**
 * Parsed payment data from an EIP-681 URI
 */
export interface ParsedPayment {
  /** Target address (contract address for ERC-20, recipient for native transfer) */
  to: string;
  /** Amount in wei (atomic units) - optional if usdAmount provided */
  value?: string;
  /** USD amount (our extension to EIP-681) */
  usdAmount?: string;
  /** Chain ID (defaults to 1 for mainnet) */
  chainId: number;
  /** Function name for contract calls (e.g., "transfer") */
  functionName?: string;
  /** Function parameters (e.g., { address: "0x...", uint256: "1000000" }) */
  parameters?: Record<string, string>;
  /** Gas limit */
  gas?: string;
  /** Gas price in wei */
  gasPrice?: string;
  /** Whether this is an ERC-20 token transfer */
  isERC20: boolean;
  /** Token contract address (same as `to` for ERC-20) */
  tokenAddress?: string;
  /** Actual recipient for ERC-20 transfers (from `address` parameter) */
  recipient?: string;
  /** Merchant name (our extension to EIP-681) */
  merchantName?: string;
  /** Merchant description (our extension to EIP-681) */
  description?: string;
}

/**
 * Resolved payment with calculated amounts
 */
export interface ResolvedPayment extends ParsedPayment {
  /** Final value in wei (calculated if only usdAmount was provided) */
  resolvedValue: string;
  /** Final USD amount (calculated if only value was provided) */
  resolvedUsdAmount: string;
  /** Token price used for conversion */
  tokenPrice: number;
  /** Whether price was calculated vs provided */
  priceCalculated: boolean;
  /** Warning message if value/usdAmount mismatch detected */
  priceWarning?: string;
  /** Token decimals (18 for ETH, varies for ERC-20) */
  decimals: number;
  /** Token symbol */
  symbol: string;
}

/**
 * Relay Price API parameters
 */
export interface RelayPriceParams {
  /** Token address or symbol (e.g., "eth" or "0x...") */
  currency: string;
  /** Chain ID */
  chainId: number;
  /** Target currency (usually "usd") */
  toCurrency?: string;
}

/**
 * Relay Price API response
 */
export interface RelayPriceResponse {
  price: string;
}

/**
 * Price cache entry
 */
export interface PriceCacheEntry {
  price: number;
  timestamp: number;
}

/**
 * Price validation result
 */
export interface PriceValidation {
  valid: boolean;
  discrepancy?: number;
  message?: string;
}

/**
 * Payment resolution options
 */
export interface PaymentResolutionOptions {
  /** Maximum acceptable price discrepancy (0-1, default 0.05 for 5%) */
  maxDiscrepancy?: number;
  /** Whether to throw on price fetch failure */
  throwOnPriceFailure?: boolean;
}

/**
 * Well-known token configurations
 */
export interface TokenConfig {
  symbol: string;
  decimals: number;
  /** Whether this is a stablecoin (affects USD conversion logic) */
  isStablecoin: boolean;
}

/**
 * Chain configuration for EIP-681 parsing
 */
export interface ChainConfig {
  name: string;
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
}

/**
 * Transaction record for display
 */
export interface Transaction {
  id: string;
  merchant: string;
  date: string;
  amount: string;
  amountUsd: string;
}

/**
 * Page view state for wallet
 */
export type PageView = "home" | "scanner";

/**
 * Scanner state machine states
 */
export type ScannerState =
  | "scanning"
  | "loading"
  | "preview"
  | "connecting"
  | "confirming"
  | "pending"  // Transaction submitted, waiting for confirmation
  | "success"
  | "error";

/**
 * Payment currency configuration for currency selection
 */
export interface PaymentCurrency {
  /** Token contract address */
  address: `0x${string}`;
  /** Token symbol (e.g., "USDC") */
  symbol: string;
  /** Token decimals */
  decimals: number;
  /** Chain ID */
  chainId: number;
  /** Chain name for display */
  chainName: string;
  /** User's balance in this token (formatted) */
  balance?: string;
  /** User's balance in wei */
  balanceWei?: bigint;
  /** Whether this is a stablecoin */
  isStablecoin: boolean;
  /** Token logo URI from Relay API */
  logoURI?: string;
  /** Token name from Relay API */
  name?: string;
}

/**
 * Payment flow state for managing currency selection
 */
export interface PaymentFlowState {
  /** Original currency from QR code */
  originalCurrency: PaymentCurrency | null;
  /** Currently selected currency for payment */
  selectedCurrency: PaymentCurrency | null;
  /** Calculated amount in selected currency */
  calculatedAmount: string;
  /** Whether the user has sufficient balance */
  hasSufficientBalance: boolean;
}
