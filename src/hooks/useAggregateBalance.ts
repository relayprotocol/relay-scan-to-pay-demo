"use client";

import { useState, useEffect, useCallback } from "react";
import { useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { formatUnits } from "viem";
import {
  SUPPORTED_CHAIN_IDS,
  SUPPORTED_TOKENS,
  NATIVE_TOKEN_ADDRESS,
  ERC20_ABI,
} from "@/lib/wallet/constants";
import { getNativeTokenPrice } from "@/lib/wallet/price";

interface AggregateBalanceResult {
  totalUsd: number;
  isLoading: boolean;
}

export function useAggregateBalance(
  address: `0x${string}` | undefined
): AggregateBalanceResult {
  const config = useConfig();
  const [totalUsd, setTotalUsd] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBalances = useCallback(async () => {
    if (!address) {
      setTotalUsd(0);
      setIsLoading(false);
      return;
    }

    try {
      const promises: Promise<number>[] = [];

      for (const chainId of SUPPORTED_CHAIN_IDS) {
        const tokens = SUPPORTED_TOKENS[chainId] || [];
        const publicClient = getPublicClient(config, { chainId });
        if (!publicClient) continue;

        for (const token of tokens) {
          if (token.address === NATIVE_TOKEN_ADDRESS) {
            // Native token: fetch via getBalance + price API
            promises.push(
              (async () => {
                try {
                  const [balance, price] = await Promise.all([
                    publicClient.getBalance({ address }),
                    getNativeTokenPrice(chainId),
                  ]);
                  if (balance === BigInt(0)) return 0;
                  return parseFloat(formatUnits(balance, 18)) * price;
                } catch {
                  return 0;
                }
              })()
            );
          } else {
            // ERC-20: fetch via balanceOf
            promises.push(
              (async () => {
                try {
                  const balance = await publicClient.readContract({
                    address: token.address,
                    abi: ERC20_ABI,
                    functionName: "balanceOf",
                    args: [address],
                  });
                  if (balance === BigInt(0)) return 0;
                  const formatted = parseFloat(formatUnits(balance, token.decimals));
                  // Stablecoins are 1:1 USD
                  return token.isStablecoin ? formatted : 0;
                } catch {
                  return 0;
                }
              })()
            );
          }
        }
      }

      const results = await Promise.all(promises);
      setTotalUsd(results.reduce((sum, val) => sum + val, 0));
    } catch {
      // Keep previous value on error
    } finally {
      setIsLoading(false);
    }
  }, [address, config]);

  // Initial fetch + 30s interval
  useEffect(() => {
    if (!address) {
      setTotalUsd(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchBalances();

    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [address, fetchBalances]);

  return { totalUsd, isLoading };
}
