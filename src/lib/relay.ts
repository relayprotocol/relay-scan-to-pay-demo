import {
  createClient,
  convertViemChainToRelayChain,
  MAINNET_RELAY_API,
  type RelayChain,
  type RelayAPIChain,
  type paths,
} from "@relayprotocol/relay-sdk";
import { mainnet, base, optimism, arbitrum, polygon } from "viem/chains";
import type { Chain } from "viem";

export { MAINNET_RELAY_API };
export type { RelayChain, RelayAPIChain, paths };

// Assets API for chain icons
export const ASSETS_RELAY_API = "https://assets.relay.link";

// Get squared light icon URL for a chain
export function getChainSquaredIconUrl(chainId: number): string {
  return `${ASSETS_RELAY_API}/icons/square/${chainId}/light.png`;
}

// Extract types from Relau SDK's OpenAPI paths
export type ChainsResponse =
  paths["/chains"]["get"]["responses"]["200"]["content"]["application/json"];
export type RelayChainData = NonNullable<ChainsResponse["chains"]>[number];

export type CurrenciesV2RequestBody = NonNullable<
  paths["/currencies/v2"]["post"]["requestBody"]
>["content"]["application/json"];
export type CurrenciesV2Response =
  paths["/currencies/v2"]["post"]["responses"]["200"]["content"]["application/json"];
export type Currency = CurrenciesV2Response[number];

export type QuoteRequestBody = NonNullable<
  paths["/quote/v2"]["post"]["requestBody"]
>["content"]["application/json"];
export type QuoteResponse =
  paths["/quote/v2"]["post"]["responses"]["200"]["content"]["application/json"];

// Default fallback chains
export const fallbackChains = [base, mainnet, optimism, arbitrum, polygon];

// Create Relay client with chains
export function createRelayClient(chains: RelayChain[]) {
  return createClient({
    baseApiUrl: MAINNET_RELAY_API,
    source: "relay-scan-to-pay-demo",
    chains:
      chains.length > 0
        ? chains
        : fallbackChains.map(convertViemChainToRelayChain),
  });
}

// Convert Relay chain data to viem Chain format
export function relayChainToViemChain(chain: RelayChainData): Chain {
  return {
    id: chain.id!,
    name: chain.displayName || chain.name || `Chain ${chain.id}`,
    nativeCurrency: {
      name: chain.currency?.name || "ETH",
      symbol: chain.currency?.symbol || "ETH",
      decimals: chain.currency?.decimals || 18,
    },
    rpcUrls: {
      default: {
        http: chain.httpRpcUrl ? [chain.httpRpcUrl] : [],
        webSocket: chain.wsRpcUrl ? [chain.wsRpcUrl] : undefined,
      },
    },
    blockExplorers: chain.explorerUrl
      ? {
          default: {
            name: chain.explorerName || "Explorer",
            url: chain.explorerUrl,
          },
        }
      : undefined,
  } as Chain;
}

// API fetchers

export async function fetchChains(): Promise<RelayAPIChain[]> {
  const response = await fetch(`${MAINNET_RELAY_API}/chains`, {
    next: { revalidate: 300 }, // Cache for 5 minutes in Next.js
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chains: ${response.status}`);
  }

  const data: ChainsResponse = await response.json();

  // Filter to enabled chains and cast to RelayAPIChain (API always returns full objects)
  return (data.chains || []).filter(
    (chain): chain is RelayAPIChain =>
      chain.depositEnabled === true && !chain.disabled,
  );
}

export async function fetchCurrencies(
  params: CurrenciesV2RequestBody = {},
): Promise<Currency[]> {
  const response = await fetch(`${MAINNET_RELAY_API}/currencies/v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to fetch currencies: ${response.status}`,
    );
  }

  return response.json();
}

export async function fetchQuote(
  params: QuoteRequestBody,
  cacheSeconds?: number,
): Promise<QuoteResponse> {
  const response = await fetch(`${MAINNET_RELAY_API}/quote/v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    ...(cacheSeconds !== undefined && { next: { revalidate: cacheSeconds } }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Quote request failed: ${response.status}`,
    );
  }

  return response.json();
}

// Intent Status API types
export type IntentStatusValue =
  | "waiting"   // Awaiting deposit confirmation
  | "pending"   // Deposit confirmed, awaiting destination submission
  | "submitted" // Destination transaction submitted
  | "success"   // Successful fill on destination
  | "delayed"   // Processing continues on destination chain
  | "refund"    // Refund in progress
  | "refunded"  // Successfully refunded
  | "failure";  // Unsuccessful fill

export interface IntentStatusResponse {
  status: IntentStatusValue;
  details?: string;
  inTxHashes?: string[];
  txHashes?: string[];
  updatedAt?: number;
  originChainId?: number;
  destinationChainId?: number;
}

export async function fetchIntentStatus(
  requestId: string,
): Promise<IntentStatusResponse> {
  const response = await fetch(
    `${MAINNET_RELAY_API}/intents/status/v3?requestId=${requestId}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to fetch intent status: ${response.status}`,
    );
  }

  return response.json();
}
