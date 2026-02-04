/**
 * Currency Conversion Hook
 *
 * Handles USD to crypto conversion using the Relay Price API.
 */

import { useState, useCallback } from "react";
import { getTokenPrice, convertUSDToWei } from "@/lib/porto/price";
import { getTokenConfig } from "@/lib/porto/price";

interface ConversionResult {
  amountWei: string;
  amountFormatted: string;
  tokenPrice: number;
  isStablecoin: boolean;
}

interface UseCurrencyConversionReturn {
  convertUSDToToken: (
    usdAmount: string,
    tokenAddress: string,
    chainId: number
  ) => Promise<ConversionResult>;
  isConverting: boolean;
  error: string | null;
}

/**
 * Hook for converting USD amounts to token amounts
 */
export function useCurrencyConversion(): UseCurrencyConversionReturn {
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertUSDToToken = useCallback(
    async (
      usdAmount: string,
      tokenAddress: string,
      chainId: number
    ): Promise<ConversionResult> => {
      setIsConverting(true);
      setError(null);

      try {
        const tokenConfig = getTokenConfig(tokenAddress, chainId);

        // For stablecoins, use 1:1 conversion
        if (tokenConfig.isStablecoin) {
          const usd = parseFloat(usdAmount);
          const amountWei = BigInt(
            Math.floor(usd * 10 ** tokenConfig.decimals)
          ).toString();

          return {
            amountWei,
            amountFormatted: usdAmount,
            tokenPrice: 1,
            isStablecoin: true,
          };
        }

        // For non-stablecoins, fetch current price
        const tokenPrice = await getTokenPrice({
          currency: tokenAddress,
          chainId,
          toCurrency: "usd",
        });

        const amountWei = convertUSDToWei(
          usdAmount,
          tokenPrice,
          tokenConfig.decimals
        );

        const tokenAmount = parseFloat(usdAmount) / tokenPrice;

        return {
          amountWei,
          amountFormatted: tokenAmount.toFixed(6),
          tokenPrice,
          isStablecoin: false,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Conversion failed";
        setError(errorMessage);
        throw err;
      } finally {
        setIsConverting(false);
      }
    },
    []
  );

  return {
    convertUSDToToken,
    isConverting,
    error,
  };
}

export default useCurrencyConversion;
