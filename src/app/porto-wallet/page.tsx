"use client";

/**
 * Porto Wallet Page
 *
 * Orchestrator for the Porto wallet experience featuring:
 * - Wallet homescreen with balance and recent transactions
 * - QR code scanner for payments
 * - Currency selection for payment flexibility
 * - Porto wallet integration using ERC-5792 (wallet_sendCalls)
 */

import { useState, useCallback, useEffect } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendCalls,
  useReadContract,
  useConfig,
  useSwitchChain,
  useWaitForCallsStatus,
} from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { getAddress, encodeFunctionData, parseAbi, formatUnits } from "viem";

import { ConnectView, HomeView, ScannerView } from "@/components/porto/views";
import { PaymentCurrencySelector } from "@/components/porto/PaymentCurrencySelector";
import {
  parseEIP681,
  type ParsedPayment,
  type ResolvedPayment,
  type PageView,
  type ScannerState,
  type PaymentCurrency,
  type Transaction,
} from "@/lib/porto";
import { ARBITRUM_USDC, ERC20_ABI, CHAIN_NAMES } from "@/lib/porto/constants";
import { parseWalletError } from "@/lib/porto/utils";
import { useRelayCurrencies } from "@/hooks/useRelayCurrencies";

export default function PortoWalletPage() {
  // View state
  const [view, setView] = useState<PageView>("home");

  // Scanner state
  const [scannerState, setScannerState] = useState<ScannerState>("scanning");
  const [parsedPayment, setParsedPayment] = useState<ParsedPayment | null>(null);
  const [resolvedPayment, setResolvedPayment] = useState<ResolvedPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callsId, setCallsId] = useState<string | null>(null);
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

  // Wagmi hooks
  const { address, isConnected, chainId: currentChainId, connector } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const { mutate: sendCalls, isPending: isSending } = useSendCalls();

  // Check if connected with Porto (not another wallet like MetaMask via Privy)
  const isPortoConnected =
    isConnected &&
    connector &&
    (connector.name.toLowerCase().includes("porto") || connector.id === "porto");

  // Track transaction confirmation status
  const { data: callsStatus, isLoading: isWaitingForConfirmation } = useWaitForCallsStatus({
    id: callsId as string,
    query: {
      enabled: !!callsId && scannerState === "pending",
      refetchInterval: 1000, // Poll every second
    },
  });

  // Update state when transaction is confirmed
  useEffect(() => {
    if (callsStatus?.status === "success") {
      setScannerState("success");
    } else if (callsStatus?.status === "failure") {
      setError("Transaction failed on chain");
      setScannerState("error");
    }
  }, [callsStatus]);

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

  // Find Porto connector - must use Porto for this page
  const portoConnector = connectors.find(
    (c) => c.name.toLowerCase().includes("porto") || c.id === "porto"
  );

  // Copy address to clipboard
  const copyAddress = useCallback(async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  // Handle wallet connection - always use Porto
  const handleConnect = useCallback(() => {
    if (portoConnector) {
      connect({ connector: portoConnector });
    } else {
      // Porto connector should always be available from layout
      console.error("Porto connector not found in:", connectors.map((c) => c.name));
      setError("Porto wallet connector not available. Please refresh the page.");
    }
  }, [connect, connectors, portoConnector]);

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

        // Set original currency as selected
        const originalCurrency: PaymentCurrency = {
          address: getAddress(parsed.tokenAddress) as `0x${string}`,
          symbol: "USDC",
          decimals: 6,
          chainId: parsed.chainId,
          chainName: CHAIN_NAMES[parsed.chainId] || `Chain ${parsed.chainId}`,
          isStablecoin: true,
        };
        setSelectedCurrency(originalCurrency);

        if (!isConnected || !address) {
          setScannerState("preview");
          return;
        }

        // Check balance
        const publicClient = getPublicClient(config, { chainId: parsed.chainId });
        if (publicClient) {
          const tokenAddress = getAddress(parsed.tokenAddress);
          const amount = BigInt(parsed.value);
          const balance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          });

          if (balance < amount) {
            const balanceFormatted = formatUnits(balance, 6);
            const requiredFormatted = formatUnits(amount, 6);
            throw new Error(`Insufficient USDC balance. You have ${balanceFormatted} but need ${requiredFormatted}.`);
          }
        }

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
      const publicClient = getPublicClient(config, { chainId: paymentChainId });
      if (!publicClient) throw new Error(`Unsupported chain: ${CHAIN_NAMES[paymentChainId] || paymentChainId}`);

      const requiredAmount = BigInt(resolvedPayment.resolvedValue);
      const tokenAddress = getAddress(selectedCurrency.address);

      // Check balance
      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });

      if (balance < requiredAmount) {
        const balanceFormatted = formatUnits(balance, selectedCurrency.decimals);
        const requiredFormatted = formatUnits(requiredAmount, selectedCurrency.decimals);
        throw new Error(`Insufficient balance. You have ${balanceFormatted} ${selectedCurrency.symbol} but need ${requiredFormatted}.`);
      }

      // Switch chain if needed
      if (currentChainId !== paymentChainId) {
        await switchChainAsync({ chainId: paymentChainId });
      }

      const recipientAddress = getAddress(resolvedPayment.recipient!);
      const data = encodeFunctionData({
        abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
        functionName: "transfer",
        args: [recipientAddress, requiredAmount],
      });

      sendCalls(
        { calls: [{ to: tokenAddress, data }], chainId: paymentChainId },
        {
          onSuccess: (result) => {
            const id = typeof result === "string" ? result : result.id;
            setCallsId(id);
            // Move to pending state - useWaitForCallsStatus will track confirmation
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
  }, [resolvedPayment, isConnected, address, config, currentChainId, switchChainAsync, sendCalls, selectedCurrency]);

  // Reset scanner state
  const handleCancelScanner = useCallback(() => {
    setParsedPayment(null);
    setResolvedPayment(null);
    setError(null);
    setCallsId(null);
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

  // Copy calls ID
  const copyCallsId = useCallback(() => {
    if (callsId) navigator.clipboard.writeText(callsId);
  }, [callsId]);

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

  // Render based on connection state and view
  // If not connected OR connected with non-Porto wallet, show connect view
  if (!isConnected || !isPortoConnected) {
    return (
      <ConnectView
        onConnect={handleConnect}
        isConnecting={isConnecting}
        wrongWallet={isConnected && !isPortoConnected}
        onDisconnect={() => disconnect()}
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
        onDisconnect={() => disconnect()}
      />
    );
  }

  return (
    <>
      <ScannerView
        scannerState={scannerState}
        resolvedPayment={resolvedPayment}
        error={error}
        callsId={callsId}
        isSending={isSending}
        selectedCurrency={selectedCurrency}
        onScan={handleScan}
        onScanError={(err) => console.error("Scan error:", err)}
        onConfirm={handleConfirm}
        onCancel={handleCancelScanner}
        onClose={closeScanner}
        onCopyCallsId={copyCallsId}
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
