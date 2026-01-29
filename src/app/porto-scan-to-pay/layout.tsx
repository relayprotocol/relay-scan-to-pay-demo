"use client";

/**
 * Porto Scan-to-Pay Layout
 *
 * Provides Porto-specific wagmi configuration separate from the
 * main app's Privy setup. This keeps Porto functionality isolated.
 */

import { type ReactNode, useMemo } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, base, optimism, arbitrum, polygon } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { porto } from "porto/wagmi";

// Create a separate QueryClient for Porto pages
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Create Porto-specific wagmi config
// Base is the primary chain for this demo
const portoConfig = createConfig({
  chains: [base, mainnet, optimism, arbitrum, polygon],
  connectors: [porto()],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
  },
  ssr: true,
});

interface PortoLayoutProps {
  children: ReactNode;
}

export default function PortoLayout({ children }: PortoLayoutProps) {
  return (
    <WagmiProvider config={portoConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
