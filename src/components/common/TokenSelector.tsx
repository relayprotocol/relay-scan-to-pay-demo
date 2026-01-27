"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Search, Check, ChevronDown, X, ShieldCheck, Plus } from "lucide-react";
import type { RelayChain } from "@relayprotocol/relay-sdk";
import { useRelayChains } from "@/providers";
import { useRelayCurrencies } from "@/hooks/useRelayCurrencies";
import { getChainSquaredIconUrl, type Currency } from "@/lib/relay";
import { cn, truncateAddress } from "@/lib/utils";
import { AllChainsIcon } from "@/components/icons/AllChainsIcon";
import { TokenIcon, TokenIconSkeleton } from "@/components/common/TokenIcon";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

// Popular chains shown at the top (in order)
const POPULAR_CHAIN_IDS = [
  1, // Ethereum
  8453, // Base
  42161, // Arbitrum
  792703809, // Solana
];

interface TokenSelectorModalProps {
  open: boolean;
  onClose: () => void;
  selectedChainId: number | null;
  selectedCurrency: Currency | null;
  onSelect: (chainId: number, currency: Currency) => void;
}

function TokenRowSkeleton() {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <TokenIconSkeleton size="md" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-16 bg-accent animate-pulse rounded" />
        <div className="h-3 w-24 bg-accent animate-pulse rounded" />
      </div>
    </div>
  );
}

// Get popular chains sorted by POPULAR_CHAIN_IDS order
function getPopularChains(chains: RelayChain[]): RelayChain[] {
  return POPULAR_CHAIN_IDS.map((id) => chains.find((c) => c.id === id)).filter(
    (c): c is RelayChain => c !== undefined,
  );
}

// Get all chains sorted alphabetically
function getAlphabeticalChains(
  chains: RelayChain[],
  searchTerm: string,
): RelayChain[] {
  let filtered = chains;

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = chains.filter(
      (c) =>
        c.displayName?.toLowerCase().includes(term) ||
        c.name?.toLowerCase().includes(term),
    );
  }

  return [...filtered].sort((a, b) => {
    const nameA = (a.displayName || a.name || "").toLowerCase();
    const nameB = (b.displayName || b.name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

function TokenList({
  currencies,
  chains,
  isLoading,
  selectedChainId,
  selectedCurrency,
  tokenSearch,
  onSelect,
}: {
  currencies: Currency[];
  chains: RelayChain[];
  isLoading: boolean;
  selectedChainId: number | null;
  selectedCurrency: Currency | null;
  tokenSearch: string;
  onSelect: (currency: Currency) => void;
}) {
  if (isLoading) {
    return (
      <div className="py-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <TokenRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (currencies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
        <p>No tokens found</p>
        {tokenSearch && (
          <p className="text-xs mt-1">Try a different search term</p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {tokenSearch ? "Search Results" : "Popular Tokens"}
      </div>
      {currencies.map((currency, idx) => {
        const currencyChain = chains.find((c) => c.id === currency.chainId);
        const isSelected =
          selectedChainId === currency.chainId &&
          selectedCurrency?.address === currency.address;

        return (
          <button
            key={`${currency.chainId}-${currency.address}-${idx}`}
            onClick={() => onSelect(currency)}
            className={cn(
              "w-full px-4 py-3 flex items-center gap-3 transition-colors",
              isSelected ? "bg-primary/10" : "hover:bg-muted/50",
            )}
          >
            <TokenIcon
              tokenLogoURI={currency.metadata?.logoURI}
              tokenSymbol={currency.symbol}
              chainIconUrl={
                currencyChain?.id
                  ? getChainSquaredIconUrl(currencyChain.id)
                  : undefined
              }
              size="md"
            />
            <div className="flex-1 min-w-0 text-left">
              <div className="font-medium text-sm">{currency.symbol}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span>{currencyChain?.displayName || currencyChain?.name}</span>
                {currency.address && (
                  <>
                    <span className="opacity-50">·</span>
                    <span className="font-mono">
                      {truncateAddress(currency.address, 4, 4)}
                    </span>
                  </>
                )}
              </div>
            </div>
            {currency.metadata?.verified && (
              <ShieldCheck className="flex-shrink-0 text-blue-500 w-4 h-4" />
            )}
          </button>
        );
      })}
    </>
  );
}

export function TokenSelectorModal({
  open,
  onClose,
  selectedChainId,
  selectedCurrency,
  onSelect,
}: TokenSelectorModalProps) {
  const { chains } = useRelayChains();
  const [activeChainId, setActiveChainId] = useState<number | null>(null);
  const [chainSearch, setChainSearch] = useState("");
  const [tokenSearch, setTokenSearch] = useState("");
  const [debouncedTokenSearch, setDebouncedTokenSearch] = useState("");
  const [showChainDropdown, setShowChainDropdown] = useState(false);

  // Debounce token search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTokenSearch(tokenSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [tokenSearch]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveChainId(selectedChainId);
      setChainSearch("");
      setTokenSearch("");
      setDebouncedTokenSearch("");
      setShowChainDropdown(false);
    }
  }, [open, selectedChainId]);

  // Get popular chains and alphabetical chains separately
  const popularChains = useMemo(() => {
    if (chainSearch) return []; // Don't show popular section when searching
    return getPopularChains(chains);
  }, [chains, chainSearch]);

  const alphabeticalChains = useMemo(() => {
    return getAlphabeticalChains(chains, chainSearch);
  }, [chains, chainSearch]);

  const activeChain = useMemo(() => {
    if (!activeChainId) return null;
    return chains.find((c) => c.id === activeChainId);
  }, [chains, activeChainId]);

  const queryParams = useMemo(() => {
    if (debouncedTokenSearch) {
      return {
        term: debouncedTokenSearch,
        chainIds: activeChainId ? [activeChainId] : undefined,
        limit: 50,
      };
    }
    return {
      chainIds: activeChainId ? [activeChainId] : undefined,
      defaultList: true,
      limit: 50,
    };
  }, [activeChainId, debouncedTokenSearch]);

  const { data: currencies = [], isLoading } = useRelayCurrencies(
    queryParams,
    open,
  );

  const handleSelect = (currency: Currency) => {
    const chainId = currency.chainId || activeChainId;
    if (chainId) {
      onSelect(chainId, currency);
      onClose();
    }
  };

  const handleChainSelect = (chainId: number | null) => {
    setActiveChainId(chainId);
    setShowChainDropdown(false);
    setChainSearch("");
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent
        className="sm:max-w-2xl p-0 gap-0 max-h-[85vh] sm:max-h-[600px]"
        showCloseButton={false}
      >
        {/* Header */}
        <ResponsiveDialogHeader className="flex-row items-center justify-between px-5 py-4 border-b space-y-0">
          <ResponsiveDialogTitle>Select Token</ResponsiveDialogTitle>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </ResponsiveDialogHeader>

        {/* Mobile Layout */}
        <div className="sm:hidden flex flex-col max-h-[calc(85vh-60px)]">
          {/* Chain Dropdown + Token Search */}
          <div className="px-4 py-3 space-y-3 border-b">
            {/* Chain Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowChainDropdown(!showChainDropdown)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-input rounded-lg bg-background"
              >
                <div className="flex items-center gap-2">
                  {activeChain ? (
                    <>
                      {activeChain.id ? (
                        <Image
                          src={getChainSquaredIconUrl(activeChain.id)}
                          alt=""
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                          {(
                            activeChain.displayName ||
                            activeChain.name ||
                            "?"
                          ).slice(0, 2)}
                        </div>
                      )}
                      <span className="text-sm font-medium">
                        {activeChain.displayName || activeChain.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <AllChainsIcon width={20} height={20} />
                      <span className="text-sm font-medium">All Chains</span>
                    </>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform",
                    showChainDropdown && "rotate-180",
                  )}
                />
              </button>

              {/* Chain Dropdown Menu */}
              {showChainDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-background border border-input rounded-lg shadow-lg max-h-64 overflow-hidden">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search chains"
                        value={chainSearch}
                        onChange={(e) => setChainSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {/* All Chains option */}
                    <button
                      onClick={() => handleChainSelect(null)}
                      className={cn(
                        "w-full px-3 py-2.5 flex items-center gap-3 transition-colors",
                        activeChainId === null
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      <AllChainsIcon width={20} height={20} />
                      <span className="text-sm font-medium">All Chains</span>
                      {activeChainId === null && (
                        <Check className="ml-auto w-4 h-4" />
                      )}
                    </button>

                    {/* Popular chains */}
                    {popularChains.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Popular
                        </div>
                        {popularChains.map((chain) => (
                          <button
                            key={`mobile-popular-${chain.id}`}
                            onClick={() => handleChainSelect(chain.id!)}
                            className={cn(
                              "w-full px-3 py-2.5 flex items-center gap-3 transition-colors",
                              activeChainId === chain.id
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted",
                            )}
                          >
                            {chain.id ? (
                              <Image
                                src={getChainSquaredIconUrl(chain.id)}
                                alt=""
                                width={20}
                                height={20}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                {(chain.displayName || chain.name || "?").slice(
                                  0,
                                  2,
                                )}
                              </div>
                            )}
                            <span className="text-sm font-medium truncate">
                              {chain.displayName || chain.name}
                            </span>
                            {activeChainId === chain.id && (
                              <Check className="ml-auto flex-shrink-0 w-4 h-4" />
                            )}
                          </button>
                        ))}
                      </>
                    )}

                    {/* All chains A-Z */}
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {chainSearch ? "Search Results" : "All Chains A-Z"}
                    </div>
                    {alphabeticalChains.map((chain) => (
                      <button
                        key={`mobile-alpha-${chain.id}`}
                        onClick={() => handleChainSelect(chain.id!)}
                        className={cn(
                          "w-full px-3 py-2.5 flex items-center gap-3 transition-colors",
                          activeChainId === chain.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted",
                        )}
                      >
                        {chain.id ? (
                          <Image
                            src={getChainSquaredIconUrl(chain.id)}
                            alt=""
                            width={20}
                            height={20}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {(chain.displayName || chain.name || "?").slice(
                              0,
                              2,
                            )}
                          </div>
                        )}
                        <span className="text-sm font-medium truncate">
                          {chain.displayName || chain.name}
                        </span>
                        {activeChainId === chain.id && (
                          <Check className="ml-auto flex-shrink-0 w-4 h-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Token Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search for a token or paste address"
                value={tokenSearch}
                onChange={(e) => setTokenSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-input rounded-lg bg-background"
              />
            </div>
          </div>

          {/* Token List */}
          <div className="flex-1 overflow-y-auto">
            <TokenList
              currencies={currencies}
              chains={chains}
              isLoading={isLoading}
              selectedChainId={selectedChainId}
              selectedCurrency={selectedCurrency}
              tokenSearch={tokenSearch}
              onSelect={handleSelect}
            />
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex h-[520px]">
          {/* Left Panel - Chain Filter */}
          <div className="w-48 border-r flex flex-col">
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search chains"
                  value={chainSearch}
                  onChange={(e) => setChainSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* All Chains option */}
              <button
                onClick={() => setActiveChainId(null)}
                className={cn(
                  "w-full px-3 py-2.5 flex items-center gap-3 transition-colors",
                  activeChainId === null
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted",
                )}
              >
                <AllChainsIcon width={24} height={24} />
                <span className="text-sm font-medium">All Chains</span>
                {activeChainId === null && (
                  <Check className="ml-auto w-4 h-4" />
                )}
              </button>

              {/* Popular chains section */}
              {popularChains.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Popular
                  </div>
                  {popularChains.map((chain) => (
                    <button
                      key={`popular-${chain.id}`}
                      onClick={() => setActiveChainId(chain.id!)}
                      className={cn(
                        "w-full px-3 py-2.5 flex items-center gap-3 transition-colors",
                        activeChainId === chain.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      {chain.id ? (
                        <Image
                          src={getChainSquaredIconUrl(chain.id)}
                          alt=""
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {(chain.displayName || chain.name || "?").slice(0, 2)}
                        </div>
                      )}
                      <span className="text-sm font-medium truncate">
                        {chain.displayName || chain.name}
                      </span>
                      {activeChainId === chain.id && (
                        <Check className="ml-auto flex-shrink-0 w-4 h-4" />
                      )}
                    </button>
                  ))}
                </>
              )}

              {/* All chains A-Z section */}
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {chainSearch ? "Search Results" : "All Chains A-Z"}
              </div>
              {alphabeticalChains.map((chain) => (
                <button
                  key={`alpha-${chain.id}`}
                  onClick={() => setActiveChainId(chain.id!)}
                  className={cn(
                    "w-full px-3 py-2.5 flex items-center gap-3 transition-colors",
                    activeChainId === chain.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {chain.id ? (
                    <Image
                      src={getChainSquaredIconUrl(chain.id)}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {(chain.displayName || chain.name || "?").slice(0, 2)}
                    </div>
                  )}
                  <span className="text-sm font-medium truncate">
                    {chain.displayName || chain.name}
                  </span>
                  {activeChainId === chain.id && (
                    <Check className="ml-auto flex-shrink-0 w-4 h-4" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel - Token List */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search for a token or paste address"
                  value={tokenSearch}
                  onChange={(e) => setTokenSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TokenList
                currencies={currencies}
                chains={chains}
                isLoading={isLoading}
                selectedChainId={selectedChainId}
                selectedCurrency={selectedCurrency}
                tokenSearch={tokenSearch}
                onSelect={handleSelect}
              />
            </div>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// Selected token button component
interface SelectedTokenButtonProps {
  chain: RelayChain | undefined;
  currency: Currency | undefined;
  onClick: () => void;
}

export function SelectedTokenButton({
  chain,
  currency,
  onClick,
}: SelectedTokenButtonProps) {
  if (!currency) {
    return (
      <button
        onClick={onClick}
        className="w-full p-4 border-2 border-dashed border-muted-foreground/30 rounded-xl text-muted-foreground hover:border-primary hover:text-foreground transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Select a token
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full p-4 border border-input rounded-xl hover:border-primary hover:bg-muted/30 transition-colors flex items-center gap-4"
    >
      <TokenIcon
        tokenLogoURI={currency.metadata?.logoURI}
        tokenSymbol={currency.symbol}
        chainIconUrl={chain?.id ? getChainSquaredIconUrl(chain.id) : undefined}
        size="lg"
      />
      <div className="flex-1 text-left min-w-0">
        <div className="font-semibold text-lg">{currency.symbol}</div>
        <div className="text-sm text-muted-foreground">
          on {chain?.displayName || chain?.name}
        </div>
      </div>
      <ChevronDown className="text-muted-foreground flex-shrink-0 w-5 h-5" />
    </button>
  );
}

// Legacy exports
export const TokenSelector = TokenSelectorModal;
export const SelectedToken = SelectedTokenButton;
