import {
  createClient,
  convertViemChainToRelayChain,
  MAINNET_RELAY_API,
  type RelayChain,
  type paths,
} from "@relayprotocol/relay-sdk";
import { mainnet, base, optimism, arbitrum, polygon } from "viem/chains";
import type { Chain } from "viem";

export { MAINNET_RELAY_API };
export type { RelayChain, paths };

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
  paths["/quote"]["post"]["requestBody"]
>["content"]["application/json"];
export type QuoteResponse =
  paths["/quote"]["post"]["responses"]["200"]["content"]["application/json"];

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

export async function fetchChains(): Promise<RelayChainData[]> {
  const response = await fetch(`${MAINNET_RELAY_API}/chains`, {
    next: { revalidate: 300 }, // Cache for 5 minutes in Next.js
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chains: ${response.status}`);
  }

  const data: ChainsResponse = await response.json();

  // Filter to enabled chains
  return (data.chains || []).filter(
    (chain) => chain.depositEnabled && !chain.disabled,
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
): Promise<QuoteResponse> {
  const response = await fetch(`${MAINNET_RELAY_API}/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Quote request failed: ${response.status}`,
    );
  }

  return response.json();
}
