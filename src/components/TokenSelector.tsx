"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import { useRelayChains } from "@/providers"
import { useRelayCurrencies } from "@/hooks/useRelayCurrencies"
import type { RelayChainData, Currency } from "@/lib/relay"
import { cn, truncateAddress } from "@/lib/utils"
import { AllChainsIcon } from "@/components/icons/AllChainsIcon"

interface TokenSelectorModalProps {
  open: boolean
  onClose: () => void
  selectedChainId: number | null
  selectedCurrency: Currency | null
  onSelect: (chainId: number, currency: Currency) => void
}

export function TokenSelectorModal({
  open,
  onClose,
  selectedChainId,
  selectedCurrency,
  onSelect,
}: TokenSelectorModalProps) {
  const { chains } = useRelayChains()
  const [activeChainId, setActiveChainId] = useState<number | null>(null)
  const [chainSearch, setChainSearch] = useState("")
  const [tokenSearch, setTokenSearch] = useState("")
  const [debouncedTokenSearch, setDebouncedTokenSearch] = useState("")
  const [showChainDropdown, setShowChainDropdown] = useState(false)

  // Debounce token search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTokenSearch(tokenSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [tokenSearch])

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveChainId(selectedChainId)
      setChainSearch("")
      setTokenSearch("")
      setDebouncedTokenSearch("")
      setShowChainDropdown(false)
    }
  }, [open, selectedChainId])

  // Filter chains by search
  const filteredChains = useMemo(() => {
    if (!chainSearch) return chains
    const term = chainSearch.toLowerCase()
    return chains.filter(
      (c) =>
        c.displayName?.toLowerCase().includes(term) ||
        c.name?.toLowerCase().includes(term)
    )
  }, [chains, chainSearch])

  // Get active chain for display
  const activeChain = useMemo(() => {
    if (!activeChainId) return null
    return chains.find((c) => c.id === activeChainId)
  }, [chains, activeChainId])

  // Build query params
  const queryParams = useMemo(() => {
    if (debouncedTokenSearch) {
      return {
        term: debouncedTokenSearch,
        chainIds: activeChainId ? [activeChainId] : undefined,
        limit: 50,
      }
    }
    return {
      chainIds: activeChainId ? [activeChainId] : undefined,
      defaultList: true,
      limit: 50,
    }
  }, [activeChainId, debouncedTokenSearch])

  const { data: currencies = [], isLoading } = useRelayCurrencies(queryParams, open)

  const handleSelect = (currency: Currency) => {
    const chainId = currency.chainId || activeChainId
    if (chainId) {
      onSelect(chainId, currency)
      onClose()
    }
  }

  const handleChainSelect = (chainId: number | null) => {
    setActiveChainId(chainId)
    setShowChainDropdown(false)
    setChainSearch("")
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "fixed z-50 bg-background border shadow-xl overflow-hidden",
          // Mobile: bottom drawer
          "inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh]",
          // Desktop: centered modal
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:rounded-2xl sm:max-w-2xl sm:w-full sm:max-h-[600px]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-semibold">Select Token</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Mobile: Chain dropdown + Token search */}
        <div className="sm:hidden px-4 pb-3 space-y-3">
          {/* Chain Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowChainDropdown(!showChainDropdown)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-input rounded-lg bg-background"
            >
              <div className="flex items-center gap-2">
                {activeChain ? (
                  <>
                    {activeChain.iconUrl ? (
                      <Image
                        src={activeChain.iconUrl}
                        alt=""
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                        {(activeChain.displayName || activeChain.name || "?").slice(0, 2)}
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "transition-transform",
                  showChainDropdown && "rotate-180"
                )}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Chain Dropdown Menu */}
            {showChainDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-background border border-input rounded-lg shadow-lg max-h-64 overflow-hidden">
                {/* Chain Search */}
                <div className="p-2 border-b">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
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

                {/* Chain List */}
                <div className="max-h-48 overflow-y-auto">
                  {/* All Chains Option */}
                  <button
                    onClick={() => handleChainSelect(null)}
                    className={cn(
                      "w-full px-3 py-2.5 flex items-center gap-3 transition-colors",
                      activeChainId === null
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <AllChainsIcon width={20} height={20} />
                    <span className="text-sm font-medium">All Chains</span>
                    {activeChainId === null && (
                      <svg
                        className="ml-auto text-primary"
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {/* Filtered Chains */}
                  {filteredChains.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => handleChainSelect(chain.id!)}
                      className={cn(
                        "w-full px-3 py-2.5 flex items-center gap-3 transition-colors",
                        activeChainId === chain.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      {chain.iconUrl ? (
                        <Image
                          src={chain.iconUrl}
                          alt=""
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {(chain.displayName || chain.name || "?").slice(0, 2)}
                        </div>
                      )}
                      <span className="text-sm font-medium truncate">
                        {chain.displayName || chain.name}
                      </span>
                      {activeChainId === chain.id && (
                        <svg
                          className="ml-auto flex-shrink-0 text-primary"
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Token Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search for a token or paste address"
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-input rounded-lg bg-background"
            />
          </div>
        </div>

        {/* Mobile: Token List */}
        <div className="sm:hidden flex-1 overflow-y-auto max-h-[50vh]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              <svg
                className="animate-spin mr-2"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Loading tokens...
            </div>
          ) : currencies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
              <p>No tokens found</p>
              {tokenSearch && (
                <p className="text-xs mt-1">Try a different search term</p>
              )}
            </div>
          ) : (
            <>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {tokenSearch ? "Search Results" : "Popular Tokens"}
              </div>
              {currencies.map((currency, idx) => {
                const currencyChain = chains.find(
                  (c) => c.id === currency.chainId
                )
                const isSelected =
                  selectedChainId === currency.chainId &&
                  selectedCurrency?.address === currency.address

                return (
                  <button
                    key={`${currency.chainId}-${currency.address}-${idx}`}
                    onClick={() => handleSelect(currency)}
                    className={cn(
                      "w-full px-4 py-3 flex items-center gap-3 transition-colors",
                      isSelected
                        ? "bg-primary/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      {currency.metadata?.logoURI ? (
                        <Image
                          src={currency.metadata.logoURI}
                          alt={currency.symbol || ""}
                          width={36}
                          height={36}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          {(currency.symbol || "?").slice(0, 2)}
                        </div>
                      )}
                      {currencyChain?.iconUrl && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-sm border border-border flex items-center justify-center">
                          <Image
                            src={currencyChain.iconUrl}
                            alt=""
                            width={14}
                            height={14}
                            className="rounded-sm"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-medium text-sm">
                        {currency.symbol}
                      </div>
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
                      <svg
                        className="flex-shrink-0 text-blue-500"
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Desktop: Two-panel layout */}
        <div className="hidden sm:flex h-[520px]">
          {/* Left Panel - Chain Filter */}
          <div className="w-48 border-r flex flex-col">
            {/* Chain Search */}
            <div className="p-3">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search chains"
                  value={chainSearch}
                  onChange={(e) => setChainSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background"
                />
              </div>
            </div>

            {/* Chain List */}
            <div className="flex-1 overflow-y-auto">
              {/* All Chains */}
              <button
                onClick={() => setActiveChainId(null)}
                className={cn(
                  "w-full px-3 py-2.5 flex items-center gap-3 transition-colors",
                  activeChainId === null
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
              >
                <AllChainsIcon width={24} height={24} />
                <span className="text-sm font-medium">All Chains</span>
                {activeChainId === null && (
                  <svg
                    className="ml-auto text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Chains A-Z header */}
              {!chainSearch && (
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Chains A-Z
                </div>
              )}

              {/* Chain list */}
              {filteredChains.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setActiveChainId(chain.id!)}
                  className={cn(
                    "w-full px-3 py-2.5 flex items-center gap-3 transition-colors",
                    activeChainId === chain.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  {chain.iconUrl ? (
                    <Image
                      src={chain.iconUrl}
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
                    <svg
                      className="ml-auto flex-shrink-0 text-primary"
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel - Token List */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Token Search */}
            <div className="p-3">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
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

            {/* Token List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  <svg
                    className="animate-spin mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Loading tokens...
                </div>
              ) : currencies.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                  <p>No tokens found</p>
                  {tokenSearch && (
                    <p className="text-xs mt-1">Try a different search term</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Section header */}
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {tokenSearch ? "Search Results" : "Popular Tokens"}
                  </div>

                  {/* Token rows */}
                  {currencies.map((currency, idx) => {
                    const currencyChain = chains.find(
                      (c) => c.id === currency.chainId
                    )
                    const isSelected =
                      selectedChainId === currency.chainId &&
                      selectedCurrency?.address === currency.address

                    return (
                      <button
                        key={`${currency.chainId}-${currency.address}-${idx}`}
                        onClick={() => handleSelect(currency)}
                        className={cn(
                          "w-full px-4 py-3 flex items-center gap-3 transition-colors",
                          isSelected
                            ? "bg-primary/10"
                            : "hover:bg-muted/50"
                        )}
                      >
                        {/* Token icon with chain badge */}
                        <div className="relative flex-shrink-0">
                          {currency.metadata?.logoURI ? (
                            <Image
                              src={currency.metadata.logoURI}
                              alt={currency.symbol || ""}
                              width={36}
                              height={36}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                              {(currency.symbol || "?").slice(0, 2)}
                            </div>
                          )}
                          {currencyChain?.iconUrl && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-sm border border-border flex items-center justify-center">
                              <Image
                                src={currencyChain.iconUrl}
                                alt=""
                                width={14}
                                height={14}
                                className="rounded-sm"
                              />
                            </div>
                          )}
                        </div>

                        {/* Token info */}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="font-medium text-sm">
                            {currency.symbol}
                          </div>
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

                        {/* Verified badge */}
                        {currency.metadata?.verified && (
                          <svg
                            className="flex-shrink-0 text-blue-500"
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Selected token button
interface SelectedTokenButtonProps {
  chain: RelayChainData | undefined
  currency: Currency | undefined
  onClick: () => void
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        Select a token
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="w-full p-4 border border-input rounded-xl hover:border-primary hover:bg-muted/30 transition-colors flex items-center gap-4"
    >
      <div className="relative flex-shrink-0">
        {currency.metadata?.logoURI ? (
          <Image
            src={currency.metadata.logoURI}
            alt={currency.symbol || ""}
            width={44}
            height={44}
            className="rounded-full"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center font-medium">
            {(currency.symbol || "?").slice(0, 2)}
          </div>
        )}
        {chain?.iconUrl && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-sm border border-border flex items-center justify-center">
            <Image
              src={chain.iconUrl}
              alt=""
              width={14}
              height={14}
              className="rounded-sm"
            />
          </div>
        )}
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="font-semibold text-lg">{currency.symbol}</div>
        <div className="text-sm text-muted-foreground">
          on {chain?.displayName || chain?.name}
        </div>
      </div>
      <svg
        className="text-muted-foreground flex-shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  )
}

// Legacy exports
export const TokenSelector = TokenSelectorModal
export const SelectedToken = SelectedTokenButton
