"use client";

/**
 * Wallet Page
 *
 * Orchestrator for the embedded wallet experience featuring:
 * - Wallet homescreen with balance and recent transactions
 * - QR code scanner for EIP-681 payments
 * - Direct send when user has the exact token the merchant requested
 * - Cross-chain / cross-token payments via Relay SDK
 * - Privy embedded wallet integration
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  useAccount,
  useWriteContract,
  useSendTransaction,
  useSwitchChain,
  useConfig,
  useWalletClient,
} from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { getPublicClient } from "wagmi/actions";
import { getAddress, formatUnits, type WalletClient } from "viem";
import { useQuote } from "@relayprotocol/relay-kit-hooks";
import {
  getClient,
  adaptViemWallet,
  type ProgressData,
} from "@relayprotocol/relay-sdk";

import { ConnectView, HomeView, ScannerView } from "@/components/wallet/views";
import { PaymentCurrencySelector } from "@/components/wallet/PaymentCurrencySelector";
import {
  parseEIP681,
  type ParsedPayment,
  type ResolvedPayment,
  type PageView,
  type ScannerState,
  type PaymentCurrency,
  type Transaction,
} from "@/lib/wallet";
import { ERC20_ABI, CHAIN_NAMES, NATIVE_TOKEN_ADDRESS } from "@/lib/wallet/constants";
import { getNativeTokenPrice } from "@/lib/wallet/price";
import { parseWalletError } from "@/lib/wallet/utils";
import { useRelayCurrencies } from "@/hooks/useRelayCurrencies";
import { useAggregateBalance } from "@/hooks/useAggregateBalance";

export default function WalletPage() {
  // View state
  const [view, setView] = useState<PageView>("home");

  // Scanner state
  const [scannerState, setScannerState] = useState<ScannerState>("scanning");
  const [parsedPayment, setParsedPayment] = useState<ParsedPayment | null>(null);
  const [resolvedPayment, setResolvedPayment] = useState<ResolvedPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Currency selection state
  const [selectedCurrency, setSelectedCurrency] = useState<PaymentCurrency | null>(null);
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);

  // Mock transactions (in production, fetch from indexer)
  const [transactions] = useState<Transaction[]>([]);

  // Transaction tracking state
  const [relayRequestId, setRelayRequestId] = useState<string | null>(null);
  const [directTxHash, setDirectTxHash] = useState<string | null>(null);

  // Ref to track if we're executing via Relay (to disable quote refetching)
  const isRelayTransacting = useRef(false);

  // Fetch Relay currency metadata for the selected token
  const selectedTokenQuery = selectedCurrency
    ? [`${selectedCurrency.chainId}:${selectedCurrency.address}`]
    : [];
  const { data: selectedCurrencyMetadata } = useRelayCurrencies(
    { tokens: selectedTokenQuery, limit: 1 },
    selectedTokenQuery.length > 0 && !selectedCurrency?.logoURI
  );

  // Update selected currency with metadata when available
  useEffect(() => {
    if (selectedCurrencyMetadata?.[0] && selectedCurrency && !selectedCurrency.logoURI) {
      const metadata = selectedCurrencyMetadata[0];
      setSelectedCurrency((prev) =>
        prev
          ? {
              ...prev,
              logoURI: metadata.metadata?.logoURI,
              name: metadata.name,
              symbol: metadata.symbol || prev.symbol,
            }
          : null
      );
    }
  }, [selectedCurrencyMetadata, selectedCurrency]);

  // Privy hooks
  const { login, logout, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();

  // Wagmi hooks
  const { address, isConnected, chainId: currentChainId } = useAccount();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const { writeContract, isPending: isSending } = useWriteContract();
  const { sendTransaction, isPending: isSendingNative } = useSendTransaction();
  const { data: walletClient } = useWalletClient();

  // Find and activate Privy embedded wallet
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");

  useEffect(() => {
    if (embeddedWallet) {
      setActiveWallet(embeddedWallet);
    }
  }, [embeddedWallet, setActiveWallet]);

  // Determine if this is a direct send (same token + same chain) or needs Relay
  const isDirectSend = useMemo(() => {
    if (!selectedCurrency || !parsedPayment) return true; // default to direct
    // Native ETH: direct send if same chain and selected currency is native
    if (!parsedPayment.isERC20) {
      return (
        selectedCurrency.chainId === parsedPayment.chainId &&
        selectedCurrency.address === NATIVE_TOKEN_ADDRESS
      );
    }
    return (
      selectedCurrency.chainId === parsedPayment.chainId &&
      selectedCurrency.address.toLowerCase() === parsedPayment.tokenAddress?.toLowerCase()
    );
  }, [selectedCurrency, parsedPayment]);

  // --- Relay SDK integration (only used for cross-chain/cross-token) ---
  const relayClient = getClient();

  const quoteOptions = useMemo(() => {
    if (
      isDirectSend ||
      !parsedPayment ||
      !address ||
      !selectedCurrency ||
      !resolvedPayment
    ) {
      return undefined;
    }

    return {
      user: address,
      originChainId: selectedCurrency.chainId,
      originCurrency: selectedCurrency.address || "0x0000000000000000000000000000000000000000",
      destinationChainId: parsedPayment.chainId,
      destinationCurrency: parsedPayment.tokenAddress!,
      amount: resolvedPayment.resolvedValue,
      recipient: parsedPayment.recipient!,
      tradeType: "EXACT_OUTPUT" as const,
      referrer: "relay-scan-to-pay-demo",
    };
  }, [isDirectSend, parsedPayment, address, selectedCurrency, resolvedPayment]);

  const {
    data: relayQuote,
    isLoading: isLoadingQuote,
    executeQuote,
  } = useQuote(
    relayClient,
    walletClient ?? undefined,
    quoteOptions,
    undefined,
    undefined,
    {
      enabled: !isDirectSend && !!quoteOptions && !isRelayTransacting.current,
      staleTime: 30 * 1000,
      refetchInterval: isRelayTransacting.current ? false : 30 * 1000,
    },
  );

  // Fetch aggregated balance across all supported chains
  const { totalUsd: balanceUsd, isLoading: isLoadingBalance } = useAggregateBalance(address);
  const formattedBalance = balanceUsd.toFixed(2);

  // Copy address to clipboard
  const copyAddress = useCallback(async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  // Handle wallet connection via Privy
  const handleConnect = useCallback(() => {
    login();
  }, [login]);

  // Handle disconnect via Privy
  const handleDisconnect = useCallback(() => {
    logout();
  }, [logout]);

  // Handle QR scan result
  const handleScan = useCallback(
    async (data: string) => {
      setScannerState("loading");
      setError(null);
      setSelectedCurrency(null);
      setRelayRequestId(null);

      try {
        const parsed = parseEIP681(data);
        if (!parsed) throw new Error("Invalid QR code format. Expected an Ethereum payment URI (EIP-681).");

        if (parsed.isERC20) {
          // ERC-20 payment
          if (!parsed.tokenAddress || !parsed.recipient || !parsed.value) {
            throw new Error("Invalid payment: missing token address, recipient, or amount.");
          }

          setParsedPayment(parsed);

          const resolved: ResolvedPayment = {
            ...parsed,
            resolvedValue: parsed.value,
            resolvedUsdAmount: parsed.usdAmount || "0",
            tokenPrice: 1,
            priceCalculated: false,
            decimals: 6,
            symbol: "USDC",
          };
          setResolvedPayment(resolved);

          const originalCurrency: PaymentCurrency = {
            address: getAddress(parsed.tokenAddress) as `0x${string}`,
            symbol: "USDC",
            decimals: 6,
            chainId: parsed.chainId,
            chainName: CHAIN_NAMES[parsed.chainId] || `Chain ${parsed.chainId}`,
            isStablecoin: true,
          };

          // Fetch balance for the original currency
          if (isConnected && address) {
            const publicClient = getPublicClient(config, { chainId: parsed.chainId });
            if (publicClient) {
              try {
                const tokenAddress = getAddress(parsed.tokenAddress);
                const balance = await publicClient.readContract({
                  address: tokenAddress,
                  abi: ERC20_ABI,
                  functionName: "balanceOf",
                  args: [address],
                });
                originalCurrency.balance = formatUnits(balance, 6);
                originalCurrency.balanceWei = balance;
              } catch {
                // Balance fetch failed — proceed without balance info
              }
            }
          }

          setSelectedCurrency(originalCurrency);
        } else {
          // Native ETH payment
          if (!parsed.to || !parsed.value) {
            throw new Error("Invalid payment: missing recipient or amount.");
          }

          // For native ETH, recipient is `to` and there's no tokenAddress
          const nativeParsed = { ...parsed, recipient: parsed.to };
          setParsedPayment(nativeParsed);

          // Resolve USD amount from price API if not provided
          let usdAmount = parsed.usdAmount || "0";
          let tokenPrice = 0;
          if (!parsed.usdAmount && parsed.value) {
            try {
              tokenPrice = await getNativeTokenPrice(parsed.chainId);
              const ethAmount = parseFloat(formatUnits(BigInt(parsed.value), 18));
              usdAmount = (ethAmount * tokenPrice).toFixed(2);
            } catch {
              // Price fetch failed, proceed with 0
            }
          }

          const nativeSymbol = parsed.chainId === 137 ? "POL" : "ETH";
          const resolved: ResolvedPayment = {
            ...nativeParsed,
            resolvedValue: parsed.value,
            resolvedUsdAmount: usdAmount,
            tokenPrice,
            priceCalculated: !parsed.usdAmount,
            decimals: 18,
            symbol: nativeSymbol,
          };
          setResolvedPayment(resolved);

          const originalCurrency: PaymentCurrency = {
            address: NATIVE_TOKEN_ADDRESS,
            symbol: nativeSymbol,
            decimals: 18,
            chainId: parsed.chainId,
            chainName: CHAIN_NAMES[parsed.chainId] || `Chain ${parsed.chainId}`,
            isStablecoin: false,
          };

          // Fetch native balance
          if (isConnected && address) {
            const publicClient = getPublicClient(config, { chainId: parsed.chainId });
            if (publicClient) {
              try {
                const balance = await publicClient.getBalance({ address });
                originalCurrency.balance = formatUnits(balance, 18);
                originalCurrency.balanceWei = balance;
              } catch {
                // Balance fetch failed — proceed without balance info
              }
            }
          }

          setSelectedCurrency(originalCurrency);
        }

        setScannerState("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process QR code");
        setScannerState("error");
      }
    },
    [isConnected, address, config]
  );

  // Handle payment confirmation — dual path: direct send or Relay SDK
  const handleConfirm = useCallback(async () => {
    if (!resolvedPayment || !isConnected || !address || !selectedCurrency) return;

    setScannerState("confirming");
    setError(null);

    try {
      if (isDirectSend) {
        // === DIRECT SEND PATH ===
        const paymentChainId = selectedCurrency.chainId;
        const requiredAmount = BigInt(resolvedPayment.resolvedValue);

        // Switch chain if needed
        if (currentChainId !== paymentChainId) {
          await switchChainAsync({ chainId: paymentChainId });
        }

        const recipientAddress = getAddress(resolvedPayment.recipient!);
        const isNativeSend = selectedCurrency.address === NATIVE_TOKEN_ADDRESS;

        if (isNativeSend) {
          // Native ETH send
          sendTransaction(
            {
              to: recipientAddress,
              value: requiredAmount,
              chainId: paymentChainId,
            },
            {
              onSuccess: (hash) => {
                setDirectTxHash(hash);
                setScannerState("success");
              },
              onError: (err) => {
                setError(parseWalletError(err));
                setScannerState("error");
              },
            }
          );
        } else {
          // ERC-20 transfer
          writeContract(
            {
              address: getAddress(selectedCurrency.address),
              abi: [
                {
                  name: "transfer",
                  type: "function",
                  stateMutability: "nonpayable",
                  inputs: [
                    { name: "to", type: "address" },
                    { name: "amount", type: "uint256" },
                  ],
                  outputs: [{ name: "", type: "bool" }],
                },
              ],
              functionName: "transfer",
              args: [recipientAddress, requiredAmount],
              chainId: paymentChainId,
            },
            {
              onSuccess: (hash) => {
                setDirectTxHash(hash);
                setScannerState("success");
              },
              onError: (err) => {
                setError(parseWalletError(err));
                setScannerState("error");
              },
            }
          );
        }
      } else {
        // === RELAY SDK PATH ===
        // User selected a different token/chain — route through Relay
        if (!relayQuote || !walletClient) {
          setError("No quote available. Please try again.");
          setScannerState("error");
          return;
        }

        isRelayTransacting.current = true;

        // Capture requestId before execution (quote may refresh)
        const requestId = relayQuote.steps?.[0]?.requestId || null;
        setRelayRequestId(requestId);

        // Adapt wallet for Relay SDK
        const adaptedWallet = adaptViemWallet(walletClient as WalletClient);

        // Switch chain if needed
        const activeChainId = await adaptedWallet.getChainId();
        if (selectedCurrency.chainId !== activeChainId) {
          await adaptedWallet.switchChain(selectedCurrency.chainId);
        }

        // Execute via Relay SDK with progress tracking
        await executeQuote((progress: ProgressData) => {
          console.log("Relay progress:", progress);

          if (progress.currentStep) {
            const stepId = progress.currentStep.id;
            if (stepId.includes("approve") && !stepId.includes("deposit")) {
              // Still in approval step
            } else {
              setScannerState("pending");
            }
          }

          const allComplete = progress.steps?.every(
            (step) => step.items?.every((item) => item.status === "complete") ?? false
          );
          if (allComplete) {
            setScannerState("success");
          }
        });

        setScannerState("success");
        isRelayTransacting.current = false;
      }
    } catch (err) {
      isRelayTransacting.current = false;
      setError(err instanceof Error ? err.message : "Transaction failed");
      setScannerState("error");
    }
  }, [
    resolvedPayment,
    isConnected,
    address,
    currentChainId,
    switchChainAsync,
    writeContract,
    sendTransaction,
    selectedCurrency,
    isDirectSend,
    relayQuote,
    walletClient,
    executeQuote,
  ]);

  // Reset scanner state
  const handleCancelScanner = useCallback(() => {
    setParsedPayment(null);
    setResolvedPayment(null);
    setError(null);
    setSelectedCurrency(null);
    setRelayRequestId(null);
    setDirectTxHash(null);
    isRelayTransacting.current = false;
    setScannerState("scanning");
  }, []);

  const closeScanner = useCallback(() => {
    handleCancelScanner();
    setView("home");
  }, [handleCancelScanner]);

  const openScanner = useCallback(() => {
    handleCancelScanner();
    setView("scanner");
  }, [handleCancelScanner]);

  // Derive insufficient balance from selected currency's balance vs required amount
  const insufficientBalance = useMemo(() => {
    if (!selectedCurrency || !resolvedPayment) return false;
    if (selectedCurrency.balanceWei === undefined) return false;
    // For Relay path, use quote's currencyIn amount if available
    if (!isDirectSend && relayQuote?.details?.currencyIn?.amount) {
      return selectedCurrency.balanceWei < BigInt(relayQuote.details.currencyIn.amount);
    }
    return selectedCurrency.balanceWei < BigInt(resolvedPayment.resolvedValue);
  }, [selectedCurrency, resolvedPayment, isDirectSend, relayQuote]);

  // Fetch native gas balance on the selected chain
  const [nativeBalance, setNativeBalance] = useState<bigint | null>(null);

  useEffect(() => {
    if (!selectedCurrency || !address || scannerState !== "preview") {
      setNativeBalance(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const publicClient = getPublicClient(config, { chainId: selectedCurrency.chainId });
        if (!publicClient) return;
        const balance = await publicClient.getBalance({ address });
        if (!cancelled) setNativeBalance(balance);
      } catch {
        if (!cancelled) setNativeBalance(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCurrency?.chainId, address, config, scannerState]);

  const MIN_GAS_WEI = BigInt(1e14);
  const isNativeSend = selectedCurrency?.address === NATIVE_TOKEN_ADDRESS;
  const insufficientGas = !isNativeSend && nativeBalance !== null && nativeBalance < MIN_GAS_WEI;

  // Handle currency selection
  const handleCurrencySelect = useCallback(
    (currency: PaymentCurrency, calculatedAmount: string) => {
      setSelectedCurrency(currency);
      if (resolvedPayment) {
        setResolvedPayment({
          ...resolvedPayment,
          resolvedValue: BigInt(Math.floor(parseFloat(calculatedAmount) * 10 ** currency.decimals)).toString(),
        });
      }
    },
    [resolvedPayment]
  );

  // Get original currency from parsed payment
  const originalCurrency: PaymentCurrency | null = parsedPayment
    ? parsedPayment.isERC20 && parsedPayment.tokenAddress
      ? {
          address: getAddress(parsedPayment.tokenAddress) as `0x${string}`,
          symbol: "USDC",
          decimals: 6,
          chainId: parsedPayment.chainId,
          chainName: CHAIN_NAMES[parsedPayment.chainId] || `Chain ${parsedPayment.chainId}`,
          isStablecoin: true,
        }
      : {
          address: NATIVE_TOKEN_ADDRESS,
          symbol: parsedPayment.chainId === 137 ? "POL" : "ETH",
          decimals: 18,
          chainId: parsedPayment.chainId,
          chainName: CHAIN_NAMES[parsedPayment.chainId] || `Chain ${parsedPayment.chainId}`,
          isStablecoin: false,
        }
    : null;

  // Update state when connection changes
  useEffect(() => {
    if (isConnected && scannerState === "connecting") {
      setScannerState("preview");
    }
  }, [isConnected, scannerState]);

  // Show loading while Privy initializes
  if (!ready) {
    return null;
  }

  // Render based on authentication state and view
  if (!authenticated) {
    return (
      <ConnectView
        onConnect={handleConnect}
        isConnecting={false}
      />
    );
  }

  if (view === "home") {
    return (
      <HomeView
        address={address!}
        balance={formattedBalance}
        balanceUsd={balanceUsd}
        isLoadingBalance={isLoadingBalance}
        transactions={transactions}
        copied={copied}
        onCopyAddress={copyAddress}
        onOpenScanner={openScanner}
        onDisconnect={handleDisconnect}
      />
    );
  }

  return (
    <>
      <ScannerView
        scannerState={scannerState}
        resolvedPayment={resolvedPayment}
        error={error}
        isSending={isSending || isSendingNative || isLoadingQuote}
        selectedCurrency={selectedCurrency}
        insufficientBalance={insufficientBalance}
        insufficientGas={insufficientGas}
        relayRequestId={relayRequestId}
        relayStatus={null}
        isDirectSend={isDirectSend}
        directTxHash={directTxHash}
        txChainId={selectedCurrency?.chainId ?? null}
        onScan={handleScan}
        onScanError={(err) => console.error("Scan error:", err)}
        onConfirm={handleConfirm}
        onCancel={handleCancelScanner}
        onClose={closeScanner}
        onChangeCurrency={() => setShowCurrencySelector(true)}
      />

      {address && resolvedPayment && (
        <PaymentCurrencySelector
          open={showCurrencySelector}
          onClose={() => setShowCurrencySelector(false)}
          selectedCurrency={selectedCurrency}
          originalCurrency={originalCurrency}
          usdAmount={resolvedPayment.resolvedUsdAmount}
          userAddress={address}
          onSelect={handleCurrencySelect}
        />
      )}
    </>
  );
}
