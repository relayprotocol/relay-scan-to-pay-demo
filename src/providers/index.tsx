"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "wagmi";
import { useMemo, useState, createContext, useContext } from "react";
import { mainnet, base, optimism, arbitrum, polygon } from "wagmi/chains";
import type { Chain } from "viem";
import {
  createClient,
  MAINNET_RELAY_API,
  type RelayChain,
  type RelayAPIChain,
} from "@relayprotocol/relay-sdk";
import { configureViemChain } from "@relayprotocol/relay-sdk/chain-utils";

// Context for sharing chain data - RelayChain is the single source of truth
interface ChainsContextType {
  chains: RelayChain[];
}

const ChainsContext = createContext<ChainsContextType>({ chains: [] });

export const useRelayChains = () => useContext(ChainsContext);

// Fallback viem chains
const fallbackViemChains: [Chain, ...Chain[]] = [
  mainnet,
  base,
  optimism,
  arbitrum,
  polygon,
];

// Create wagmi config from chains
function createWagmiConfig(viemChains: Chain[]) {
  const chains =
    viemChains.length > 0
      ? (viemChains as [Chain, ...Chain[]])
      : fallbackViemChains;

  const transports: Record<number, ReturnType<typeof http>> = {};
  for (const chain of chains) {
    const rpcUrl = chain.rpcUrls.default.http[0];
    transports[chain.id] = http(rpcUrl || undefined);
  }

  return createConfig({
    chains,
    transports,
    ssr: true,
  });
}

interface ProvidersProps {
  children: React.ReactNode;
  chains?: RelayAPIChain[];
}

export function Providers({
  children,
  chains: apiChains = [],
}: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  // Convert API chains to RelayChain with viemChain configured
  const { relayChains, wagmiConfig, privyChains } = useMemo(() => {
    // Convert API chains to RelayChain format with viemChain attached
    const configuredChains: RelayChain[] =
      apiChains.length > 0
        ? apiChains.map((chain) => configureViemChain(chain))
        : [];

    // Extract viem chains for wagmi/privy, or use fallbacks
    const viemChains: Chain[] =
      configuredChains.length > 0
        ? configuredChains
            .map((c) => c.viemChain)
            .filter((c): c is Chain => c !== undefined)
        : fallbackViemChains;

    // Initialize Relay client singleton
    createClient({
      baseApiUrl: MAINNET_RELAY_API,
      source: "relay-scan-to-pay-demo",
      chains: configuredChains,
      pollingInterval: 10000,
    });

    return {
      relayChains: configuredChains,
      wagmiConfig: createWagmiConfig(viemChains),
      privyChains: viemChains,
    };
  }, [apiChains]);

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#676FFF",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: privyChains[0],
        supportedChains: privyChains,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <ChainsContext.Provider value={{ chains: relayChains }}>
            {children}
          </ChainsContext.Provider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
