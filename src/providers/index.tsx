"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { useMemo, useState, createContext, useContext } from "react";
import { mainnet, base, optimism, arbitrum, polygon } from "wagmi/chains";
import type { Chain } from "viem";
import {
  createClient as createRelayClient,
  convertViemChainToRelayChain,
  MAINNET_RELAY_API,
} from "@relayprotocol/relay-sdk";
import { relayChainToViemChain, type RelayChainData } from "@/lib/relay";

// Context for sharing chain data
interface ChainsContextType {
  chains: RelayChainData[];
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
  chains?: RelayChainData[];
}

export function Providers({ children, chains = [] }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  // Convert relay chains to viem chains and create configs
  const { wagmiConfig, privyChains } = useMemo(() => {
    const viemChains =
      chains.length > 0
        ? chains.map(relayChainToViemChain)
        : fallbackViemChains;

    // Initialize Relay client globally (singleton)
    createRelayClient({
      baseApiUrl: MAINNET_RELAY_API,
      source: "relay-scan-to-pay-demo",
      chains: viemChains.map(convertViemChainToRelayChain),
    });

    return {
      wagmiConfig: createWagmiConfig(viemChains),
      privyChains: viemChains,
    };
  }, [chains]);

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  const content = (
    <ChainsContext.Provider value={{ chains }}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </ChainsContext.Provider>
  );

  if (!privyAppId) {
    console.warn(
      "NEXT_PUBLIC_PRIVY_APP_ID not set. Privy features will be disabled.",
    );
    return content;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
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
      {content}
    </PrivyProvider>
  );
}
