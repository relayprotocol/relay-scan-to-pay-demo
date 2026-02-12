"use client";

/**
 * Payment Currency Selector Component
 *
 * Coinbase Pay-inspired token selector modal.
 * Fetches user balances and queries Relay currencies API for token metadata.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { formatUnits } from "viem";
import { ArrowLeft, Loader2, Check, AlertCircle, ChevronDown } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useRelayCurrencies } from "@/hooks/useRelayCurrencies";
import {
  CHAIN_NAMES,
  SUPPORTED_CHAIN_IDS,
  SUPPORTED_TOKENS,
  ERC20_ABI,
} from "@/lib/wallet/constants";
import { getChainSquaredIconUrl, type Currency } from "@/lib/relay";
import { cn } from "@/lib/utils";
import type { PaymentCurrency } from "@/lib/wallet/types";

interface PaymentCurrencySelectorProps {
  open: boolean;
  onClose: () => void;
  selectedCurrency: PaymentCurrency | null;
  originalCurrency: PaymentCurrency | null;
  usdAmount: string;
  userAddress: `0x${string}`;
  onSelect: (currency: PaymentCurrency, calculatedAmount: string) => void;
}

interface TokenWithBalance {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  chainId: number;
  chainName: string;
  balance: string;
  balanceWei: bigint;
  balanceUsd: string;
  isStablecoin: boolean;
  hasInsufficientBalance: boolean;
  requiredAmount: string;
  // Relay metadata
  logoURI?: string;
  name?: string;
}

export function PaymentCurrencySelector({
  open,
  onClose,
  selectedCurrency,
  originalCurrency,
  usdAmount,
  userAddress,
  onSelect,
}: PaymentCurrencySelectorProps) {
  const config = useConfig();
  const [tokens, setTokens] = useState<TokenWithBalance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChainFilter, setSelectedChainFilter] = useState<number | null>(null);
  const [showChainDropdown, setShowChainDropdown] = useState(false);

  // Build token query for Relay API - format: 'chainId:address'
  const tokenQueryList = useMemo(() => {
    const tokenIds: string[] = [];
    for (const chainId of SUPPORTED_CHAIN_IDS) {
      const chainTokens = SUPPORTED_TOKENS[chainId] || [];
      for (const token of chainTokens) {
        tokenIds.push(`${chainId}:${token.address}`);
      }
    }
    return tokenIds;
  }, []);

  // Fetch currency metadata from Relay API
  const { data: relayCurrencies = [], isLoading: isLoadingRelay } = useRelayCurrencies(
    {
      tokens: tokenQueryList,
      limit: 50,
    },
    open && tokenQueryList.length > 0
  );

  // Create a lookup map for Relay currency data
  const currencyMetadataMap = useMemo(() => {
    const map = new Map<string, Currency>();
    for (const currency of relayCurrencies) {
      const key = `${currency.chainId}:${currency.address?.toLowerCase()}`;
      map.set(key, currency);
    }
    return map;
  }, [relayCurrencies]);

  // Fetch balances for all supported tokens when modal opens
  const fetchBalances = useCallback(async () => {
    if (!open || !userAddress) return;

    setIsLoadingBalances(true);
    setError(null);

    try {
      const tokenPromises: Promise<TokenWithBalance | null>[] = [];

      for (const chainId of SUPPORTED_CHAIN_IDS) {
        const chainTokens = SUPPORTED_TOKENS[chainId] || [];

        for (const token of chainTokens) {
          tokenPromises.push(
            (async () => {
              try {
                const publicClient = getPublicClient(config, { chainId });
                if (!publicClient) return null;

                const balance = await publicClient.readContract({
                  address: token.address,
                  abi: ERC20_ABI,
                  functionName: "balanceOf",
                  args: [userAddress],
                });

                // Only include tokens with balance > 0
                if (balance === BigInt(0)) return null;

                const formattedBalance = formatUnits(balance, token.decimals);
                const balanceNum = parseFloat(formattedBalance);

                // For stablecoins, USD value = balance
                const balanceUsd = token.isStablecoin
                  ? balanceNum.toFixed(2)
                  : balanceNum.toFixed(2); // Would need price for non-stablecoins

                // Required amount for this token
                const requiredAmount = token.isStablecoin ? usdAmount : usdAmount;
                const requiredWei = BigInt(
                  Math.floor(parseFloat(requiredAmount) * 10 ** token.decimals)
                );

                // Get metadata from Relay API
                const metadataKey = `${chainId}:${token.address.toLowerCase()}`;
                const metadata = currencyMetadataMap.get(metadataKey);

                return {
                  address: token.address,
                  symbol: metadata?.symbol || token.symbol,
                  name: metadata?.name,
                  decimals: token.decimals,
                  chainId,
                  chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
                  balance: formattedBalance,
                  balanceWei: balance,
                  balanceUsd,
                  isStablecoin: token.isStablecoin,
                  hasInsufficientBalance: balance < requiredWei,
                  requiredAmount,
                  logoURI: metadata?.metadata?.logoURI,
                };
              } catch (err) {
                console.error(
                  `Failed to fetch balance for ${token.symbol} on chain ${chainId}:`,
                  err
                );
                return null;
              }
            })()
          );
        }
      }

      const results = await Promise.all(tokenPromises);
      const validTokens = results.filter((t): t is TokenWithBalance => t !== null);

      // Sort: tokens with sufficient balance first, then by USD balance
      validTokens.sort((a, b) => {
        if (a.hasInsufficientBalance !== b.hasInsufficientBalance) {
          return a.hasInsufficientBalance ? 1 : -1;
        }
        return parseFloat(b.balanceUsd) - parseFloat(a.balanceUsd);
      });

      setTokens(validTokens);
    } catch (err) {
      console.error("Failed to fetch token balances:", err);
      setError("Failed to load your token balances");
    } finally {
      setIsLoadingBalances(false);
    }
  }, [open, userAddress, config, usdAmount, currencyMetadataMap]);

  // Refetch when metadata is loaded
  useEffect(() => {
    if (open && !isLoadingRelay) {
      fetchBalances();
    }
  }, [open, isLoadingRelay, fetchBalances]);

  // Filter tokens by selected chain
  const filteredTokens = useMemo(() => {
    if (!selectedChainFilter) return tokens;
    return tokens.filter((t) => t.chainId === selectedChainFilter);
  }, [tokens, selectedChainFilter]);

  // Get unique chains from tokens
  const availableChains = useMemo(() => {
    const chainIds = new Set(tokens.map((t) => t.chainId));
    return Array.from(chainIds).map((id) => ({
      id,
      name: CHAIN_NAMES[id] || `Chain ${id}`,
    }));
  }, [tokens]);

  // Check if a token matches the original currency
  const isOriginalToken = useCallback(
    (token: TokenWithBalance) => {
      if (!originalCurrency) return false;
      return (
        token.address.toLowerCase() === originalCurrency.address.toLowerCase() &&
        token.chainId === originalCurrency.chainId
      );
    },
    [originalCurrency]
  );

  // Check if a token is currently selected
  const isSelectedToken = useCallback(
    (token: TokenWithBalance) => {
      if (!selectedCurrency) return false;
      return (
        token.address.toLowerCase() === selectedCurrency.address.toLowerCase() &&
        token.chainId === selectedCurrency.chainId
      );
    },
    [selectedCurrency]
  );

  const handleSelect = useCallback(
    (token: TokenWithBalance) => {
      if (token.hasInsufficientBalance) return;

      onSelect(
        {
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals,
          chainId: token.chainId,
          chainName: token.chainName,
          balance: token.balance,
          balanceWei: token.balanceWei,
          isStablecoin: token.isStablecoin,
        },
        token.requiredAmount
      );
      onClose();
    },
    [onSelect, onClose]
  );

  const isLoading = isLoadingBalances || isLoadingRelay;

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent
        className="sm:max-w-md p-0 gap-0 max-h-[85vh] sm:max-h-[600px]"
        showCloseButton={false}
      >
        {/* Header */}
        <ResponsiveDialogHeader className="flex-row items-center px-4 py-4 border-b space-y-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors mr-3"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ResponsiveDialogTitle className="flex-1">Choose asset</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {/* Chain Filter */}
        {availableChains.length > 1 && (
          <div className="px-4 py-3 border-b">
            <div className="relative">
              <button
                onClick={() => setShowChainDropdown(!showChainDropdown)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-full text-sm transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>{selectedChainFilter ? CHAIN_NAMES[selectedChainFilter] : "All Chains"}</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showChainDropdown && "rotate-180")} />
              </button>

              {showChainDropdown && (
                <div className="absolute top-full left-0 mt-1 z-10 bg-background border border-border rounded-lg shadow-lg min-w-[160px] py-1">
                  <button
                    onClick={() => {
                      setSelectedChainFilter(null);
                      setShowChainDropdown(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between",
                      !selectedChainFilter && "text-primary font-medium"
                    )}
                  >
                    All Chains
                    {!selectedChainFilter && <Check className="w-4 h-4" />}
                  </button>
                  {availableChains.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => {
                        setSelectedChainFilter(chain.id);
                        setShowChainDropdown(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2",
                        selectedChainFilter === chain.id && "text-primary font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Image
                          src={getChainSquaredIconUrl(chain.id)}
                          alt=""
                          width={16}
                          height={16}
                          className="rounded"
                        />
                        {chain.name}
                      </div>
                      {selectedChainFilter === chain.id && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Loading your assets...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <AlertCircle className="w-8 h-8 text-destructive mb-3" />
              <p className="text-sm text-muted-foreground text-center">{error}</p>
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <p className="text-sm text-muted-foreground text-center">
                {tokens.length === 0
                  ? "No supported tokens found in your wallet"
                  : "No tokens on this chain"}
              </p>
              {tokens.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Add USDC on Base, Ethereum, Optimism, Arbitrum, or Polygon
                </p>
              )}
            </div>
          ) : (
            <div className="py-2">
              {filteredTokens.map((token) => (
                <button
                  key={`${token.chainId}-${token.address}`}
                  onClick={() => handleSelect(token)}
                  disabled={token.hasInsufficientBalance}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-3 transition-colors",
                    token.hasInsufficientBalance
                      ? "opacity-50 cursor-not-allowed"
                      : isSelectedToken(token)
                        ? "bg-primary/10"
                        : "hover:bg-muted/50"
                  )}
                >
                  {/* Token Icon */}
                  <div className="relative flex-shrink-0">
                    {token.logoURI ? (
                      <Image
                        src={token.logoURI}
                        alt={token.symbol}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {token.symbol.slice(0, 2)}
                      </div>
                    )}
                    {/* Chain badge */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded border border-border flex items-center justify-center">
                      <Image
                        src={getChainSquaredIconUrl(token.chainId)}
                        alt=""
                        width={12}
                        height={12}
                        className="rounded-sm"
                      />
                    </div>
                  </div>

                  {/* Token Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{token.name || token.symbol}</span>
                      {isOriginalToken(token) && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          Original
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {token.symbol}
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-right">
                    <div className="font-medium">${token.balanceUsd}</div>
                    <div className="text-xs text-muted-foreground">
                      {parseFloat(token.balance).toFixed(2)} {token.symbol}
                    </div>
                    {token.hasInsufficientBalance && (
                      <div className="text-xs text-destructive mt-0.5">
                        Need {parseFloat(token.requiredAmount).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Selected Indicator */}
                  {isSelectedToken(token) && !token.hasInsufficientBalance && (
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export default PaymentCurrencySelector;
