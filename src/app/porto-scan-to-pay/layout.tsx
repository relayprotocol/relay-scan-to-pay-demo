"use client";

/**
 * Porto Wallet Layout
 *
 * Provides Porto-specific wagmi configuration separate from the
 * main app's Privy setup. This keeps Porto functionality isolated.
 */

import { type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, base, optimism, arbitrum, polygon } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { porto } from "porto/wagmi";
import { Mode, Dialog } from "porto";

// Create a separate QueryClient for Porto pages
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Simple shadcn-like theme for Porto
const portoTheme = {
  colorScheme: "light" as const,
  // Neutral grayscale like shadcn
  accent: "#18181b", // zinc-900
  focus: "#18181b",
  // Clean white backgrounds
  baseBackground: "#ffffff",
  baseAltBackground: "#fafafa", // zinc-50
  basePlaneBackground: "#f4f4f5", // zinc-100
  frameBackground: "#ffffff",
  fieldBackground: "#ffffff",
  // Text colors
  baseContent: "#18181b", // zinc-900
  baseContentSecondary: "#71717a", // zinc-500
  baseContentTertiary: "#a1a1aa", // zinc-400
  // Borders
  baseBorder: "#e4e4e7", // zinc-200
  baseBorderHover: "#d4d4d8", // zinc-300
  // Buttons - primary is dark
  buttonPrimaryBackground: "#18181b",
  buttonPrimaryContent: "#ffffff",
  buttonSecondaryBackground: "#f4f4f5",
  buttonSecondaryContent: "#18181b",
  // Subtle radius like shadcn
  radiusSmall: 6,
  radiusMedium: 8,
  radiusLarge: 12,
  frameRadius: 12,
};

// Create Porto-specific wagmi config with custom theme
const portoConfig = createConfig({
  chains: [base, mainnet, optimism, arbitrum, polygon],
  connectors: [
    porto({
      mode: Mode.dialog({
        renderer: Dialog.popup(),
        theme: portoTheme,
      }),
    }),
  ],
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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
