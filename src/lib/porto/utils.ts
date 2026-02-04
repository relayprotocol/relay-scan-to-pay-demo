/**
 * Porto Wallet Utilities
 *
 * Helper functions for the Porto wallet integration.
 */

import { EXPLORER_URLS } from "./constants";

/**
 * Parse Porto/wallet errors into user-friendly messages
 */
export function parseWalletError(error: Error): string {
  const message = error.message || "";

  if (
    message.includes("revertData") ||
    message.includes("simulation") ||
    message.includes("Simulation") ||
    message.includes("insufficient") ||
    message.includes("Insufficient")
  ) {
    return "Insufficient funds. Please make sure your wallet has enough balance to cover the payment and gas fees.";
  }

  if (
    message.includes("rejected") ||
    message.includes("denied") ||
    message.includes("cancelled") ||
    message.includes("User rejected")
  ) {
    return "Transaction was cancelled.";
  }

  if (
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("timeout")
  ) {
    return "Network error. Please check your connection and try again.";
  }

  if (message.includes("chain") && message.includes("switch")) {
    return "Please switch to the correct network in your wallet.";
  }

  if (message.length > 200) {
    return message.slice(0, 200) + "...";
  }

  return message || "Transaction failed. Please try again.";
}

/**
 * Get block explorer URL for an address or transaction
 */
export function getExplorerUrl(
  chainId: number,
  addressOrHash: string,
  type: "address" | "tx" = "address"
): string {
  const baseUrl = EXPLORER_URLS[chainId] || "https://etherscan.io";
  return `${baseUrl}/${type}/${addressOrHash}`;
}

/**
 * Get block explorer URL for a token on a specific chain
 */
export function getTokenExplorerUrl(
  chainId: number,
  tokenAddress: string
): string {
  const baseUrl = EXPLORER_URLS[chainId] || "https://etherscan.io";
  return `${baseUrl}/token/${tokenAddress}`;
}
