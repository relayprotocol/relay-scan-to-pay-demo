/**
 * Wallet Constants
 *
 * Shared constants for the wallet integration.
 */

import { parseAbi } from "viem";
import { mainnet, base, optimism, arbitrum, polygon } from "wagmi/chains";

/**
 * Arbitrum USDC - primary stablecoin for balance display
 */
export const ARBITRUM_USDC = {
  chainId: 42161,
  address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}`,
  symbol: "USDC",
  decimals: 6,
} as const;

/**
 * ERC-20 ABI for common operations
 */
export const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

/**
 * Chain name lookup
 */
export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum",
  43114: "Avalanche",
  56: "BNB Chain",
  84532: "Base Sepolia",
  11155111: "Sepolia",
};

/**
 * Supported chains
 */
export const SUPPORTED_CHAINS = [base, mainnet, optimism, arbitrum, polygon] as const;

/**
 * Supported chain IDs for quick lookup
 */
export const SUPPORTED_CHAIN_IDS = SUPPORTED_CHAINS.map((chain) => chain.id);

/**
 * Block explorer URLs by chain ID
 */
export const EXPLORER_URLS: Record<number, string> = {
  1: "https://etherscan.io",
  10: "https://optimistic.etherscan.io",
  137: "https://polygonscan.com",
  8453: "https://basescan.org",
  42161: "https://arbiscan.io",
  43114: "https://snowtrace.io",
  56: "https://bscscan.com",
  84532: "https://sepolia.basescan.org",
  11155111: "https://sepolia.etherscan.io",
};

/**
 * Zero address representing native token
 */
export const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

/**
 * Supported tokens for currency selection (tokens users can pay with)
 * Maps chainId -> token configs
 */
export const SUPPORTED_TOKENS: Record<
  number,
  Array<{
    address: `0x${string}`;
    symbol: string;
    decimals: number;
    isStablecoin: boolean;
  }>
> = {
  // Ethereum
  1: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "ETH",
      decimals: 18,
      isStablecoin: false,
    },
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      decimals: 6,
      isStablecoin: true,
    },
    {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      symbol: "USDT",
      decimals: 6,
      isStablecoin: true,
    },
  ],
  // Optimism
  10: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "ETH",
      decimals: 18,
      isStablecoin: false,
    },
    {
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      symbol: "USDC",
      decimals: 6,
      isStablecoin: true,
    },
  ],
  // Polygon
  137: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "POL",
      decimals: 18,
      isStablecoin: false,
    },
    {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      symbol: "USDC",
      decimals: 6,
      isStablecoin: true,
    },
  ],
  // Base
  8453: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "ETH",
      decimals: 18,
      isStablecoin: false,
    },
    {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      decimals: 6,
      isStablecoin: true,
    },
  ],
  // Arbitrum
  42161: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "ETH",
      decimals: 18,
      isStablecoin: false,
    },
    {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      symbol: "USDC",
      decimals: 6,
      isStablecoin: true,
    },
  ],
};
