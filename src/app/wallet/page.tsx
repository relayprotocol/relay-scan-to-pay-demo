"use client";

/**
 * Wallet Page
 *
 * Orchestrator for the embedded wallet experience featuring:
 * - Wallet homescreen with balance and recent transactions
 * - QR code scanner for payments
 * - Currency selection for payment flexibility
 * - Privy embedded wallet integration
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useSwitchChain,
  useConfig,
} from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { getPublicClient } from "wagmi/actions";
import { getAddress, formatUnits } from "viem";

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
import { ARBITRUM_USDC, ERC20_ABI, CHAIN_NAMES } from "@/lib/wallet/constants";
import { parseWalletError } from "@/lib/wallet/utils";
import { useRelayCurrencies } from "@/hooks/useRelayCurrencies";
import { useRelayTracking } from "@/hooks/useRelayTracking";

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

  // Find and activate Privy embedded wallet
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");

  useEffect(() => {
    if (embeddedWallet) {
      setActiveWallet(embeddedWallet);
    }
  }, [embeddedWallet, setActiveWallet]);

  // The deposit address from the EIP-681 URI (recipient field) — used for Relay tracking
  const depositAddress = resolvedPayment?.recipient ?? null;

  // Track Relay payment status by deposit address
  const { data: relayRequest } = useRelayTracking(depositAddress, {
    pollingInterval: 3000,
    enabled: !!depositAddress && scannerState === "pending",
  });

  // Update state based on Relay intent status
  useEffect(() => {
    if (!relayRequest?.status) return;
    if (relayRequest.status === "success") {
      setScannerState("success");
    } else if (relayRequest.status === "failure" || relayRequest.status === "refund") {
      setError(relayRequest.status === "refund" ? "Payment was refunded" : "Payment failed");
      setScannerState("error");
    }
  }, [relayRequest]);

  // Fetch USDC balance on Arbitrum
  const { data: usdcBalance, isLoading: isLoadingBalance } = useReadContract({
    address: ARBITRUM_USDC.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARBITRUM_USDC.chainId,
    query: { enabled: !!address, refetchInterval: 30000 },
  });

  const formattedBalance = usdcBalance ? formatUnits(usdcBalance, ARBITRUM_USDC.decimals) : "0";
  const balanceUsd = usdcBalance ? parseFloat(formatUnits(usdcBalance, ARBITRUM_USDC.decimals)) : 0;

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

      try {
        const parsed = parseEIP681(data);
        if (!parsed) throw new Error("Invalid QR code format. Expected an Ethereum payment URI (EIP-681).");
        if (!parsed.isERC20) throw new Error("Only ERC-20 token transfers are supported.");
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

        // Set original currency as selected, with balance if available
        const originalCurrency: PaymentCurrency = {
          address: getAddress(parsed.tokenAddress) as `0x${string}`,
          symbol: "USDC",
          decimals: 6,
          chainId: parsed.chainId,
          chainName: CHAIN_NAMES[parsed.chainId] || `Chain ${parsed.chainId}`,
          isStablecoin: true,
        };

        // Fetch balance for the original currency so we can show insufficient balance reactively
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
              // Balance fetch failed — don't block, just proceed without balance info
            }
          }
        }

        setSelectedCurrency(originalCurrency);
        setScannerState("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process QR code");
        setScannerState("error");
      }
    },
    [isConnected, address, config]
  );

  // Handle payment confirmation
  const handleConfirm = useCallback(async () => {
    if (!resolvedPayment || !isConnected || !address || !selectedCurrency) return;

    setScannerState("confirming");
    setError(null);

    try {
      const paymentChainId = selectedCurrency.chainId;
      const requiredAmount = BigInt(resolvedPayment.resolvedValue);

      // Switch chain if needed
      if (currentChainId !== paymentChainId) {
        await switchChainAsync({ chainId: paymentChainId });
      }

      const recipientAddress = getAddress(resolvedPayment.recipient!);

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
          onSuccess: () => {
            setScannerState("pending");
          },
          onError: (err) => {
            setError(parseWalletError(err));
            setScannerState("error");
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setScannerState("error");
    }
  }, [resolvedPayment, isConnected, address, currentChainId, switchChainAsync, writeContract, selectedCurrency]);

  // Reset scanner state
  const handleCancelScanner = useCallback(() => {
    setParsedPayment(null);
    setResolvedPayment(null);
    setError(null);
    setSelectedCurrency(null);
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

  // Get the Relay request ID for "View payment" links
  const relayRequestId = relayRequest?.id ?? null;
  const relayStatus = relayRequest?.status ?? null;

  // Derive insufficient balance from selected currency's balance vs required amount
  const insufficientBalance = useMemo(() => {
    if (!selectedCurrency || !resolvedPayment) return false;
    if (selectedCurrency.balanceWei === undefined) return false;
    return selectedCurrency.balanceWei < BigInt(resolvedPayment.resolvedValue);
  }, [selectedCurrency, resolvedPayment]);

  // Fetch native gas balance on the selected chain to ensure user can send txs
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

  // 0.0001 native token — enough for several L2 txs, conservative for mainnet
  const MIN_GAS_WEI = BigInt(1e14);
  const insufficientGas = nativeBalance !== null && nativeBalance < MIN_GAS_WEI;

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
  const originalCurrency: PaymentCurrency | null = parsedPayment?.tokenAddress
    ? {
        address: getAddress(parsedPayment.tokenAddress) as `0x${string}`,
        symbol: "USDC",
        decimals: 6,
        chainId: parsedPayment.chainId,
        chainName: CHAIN_NAMES[parsedPayment.chainId] || `Chain ${parsedPayment.chainId}`,
        isStablecoin: true,
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
        isSending={isSending}
        selectedCurrency={selectedCurrency}
        insufficientBalance={insufficientBalance}
        insufficientGas={insufficientGas}
        relayRequestId={relayRequestId}
        relayStatus={relayStatus}
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
