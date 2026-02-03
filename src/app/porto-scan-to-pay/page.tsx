"use client";

/**
 * Porto Wallet Page
 *
 * A native wallet experience featuring:
 * - Wallet homescreen with balance and recent transactions
 * - QR code scanner for payments
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
} from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { getAddress, encodeFunctionData, parseAbi, formatUnits } from "viem";
import Link from "next/link";
import {
  ArrowLeft,
  Wallet,
  QrCode,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { QRScanner, PaymentPreview } from "@/components/porto";
import {
  parseEIP681,
  validatePayment,
  resolvePaymentAmount,
  type ParsedPayment,
  type ResolvedPayment,
} from "@/lib/porto";
import { truncateAddress, formatUsd } from "@/lib/utils";

// Arbitrum USDC - primary stablecoin for balance display
const ARBITRUM_USDC = {
  chainId: 42161,
  address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}`,
  symbol: "USDC",
  decimals: 6,
};

// ERC-20 ABI for balance
const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

// Chain name lookup
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum",
  43114: "Avalanche",
  56: "BNB Chain",
  84532: "Base Sepolia",
  11155111: "Sepolia",
};

// Mock recent transactions (in production, fetch from indexer)
interface Transaction {
  id: string;
  merchant: string;
  date: string;
  amount: string;
  amountUsd: string;
}

/**
 * Parse Porto/wallet errors into user-friendly messages
 */
function parseWalletError(error: Error): string {
  const message = error.message || "";

  if (
    message.includes("revertData") ||
    message.includes("simulation") ||
    message.includes("Simulation") ||
    message.includes("insufficient") ||
    message.includes("Insufficient")
  ) {
    return "Insufficient funds. Please make sure your wallet has enough balance to cover the payment and gas fees.";
  }

  if (
    message.includes("rejected") ||
    message.includes("denied") ||
    message.includes("cancelled") ||
    message.includes("User rejected")
  ) {
    return "Transaction was cancelled.";
  }

  if (
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("timeout")
  ) {
    return "Network error. Please check your connection and try again.";
  }

  if (message.includes("chain") && message.includes("switch")) {
    return "Please switch to the correct network in your wallet.";
  }

  if (message.length > 200) {
    return message.slice(0, 200) + "...";
  }

  return message || "Transaction failed. Please try again.";
}

type PageView = "home" | "scanner";
type ScannerState =
  | "scanning"
  | "loading"
  | "preview"
  | "connecting"
  | "confirming"
  | "success"
  | "error";

export default function PortoWalletPage() {
  // View state
  const [view, setView] = useState<PageView>("home");

  // Scanner state
  const [scannerState, setScannerState] = useState<ScannerState>("scanning");
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [parsedPayment, setParsedPayment] = useState<ParsedPayment | null>(
    null
  );
  const [resolvedPayment, setResolvedPayment] =
    useState<ResolvedPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callsId, setCallsId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Mock transactions (in production, fetch from indexer)
  const [transactions] = useState<Transaction[]>([]);

  // Wagmi hooks for Porto
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const config = useConfig();

  // Use ERC-5792 sendCalls for Porto compatibility
  const { mutate: sendCalls, isPending: isSending } = useSendCalls();

  // Fetch USDC balance on Arbitrum
  const { data: usdcBalance, isLoading: isLoadingBalance } = useReadContract({
    address: ARBITRUM_USDC.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARBITRUM_USDC.chainId,
    query: {
      enabled: !!address,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Format balance for display
  const formattedBalance = usdcBalance
    ? formatUnits(usdcBalance, ARBITRUM_USDC.decimals)
    : "0";

  const balanceUsd = usdcBalance
    ? parseFloat(formatUnits(usdcBalance, ARBITRUM_USDC.decimals))
    : 0;

  // Find Porto connector
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

  // Handle QR scan result - check balance and prompt wallet immediately
  const handleScan = useCallback(
    async (data: string) => {
      console.log("Scanned QR code:", data);
      setScannedData(data);
      setScannerState("loading");
      setError(null);

      try {
        const parsed = parseEIP681(data);

        if (!parsed) {
          throw new Error(
            "Invalid QR code format. Expected an Ethereum payment URI (EIP-681)."
          );
        }

        const validation = validatePayment(parsed);
        if (!validation.valid) {
          throw new Error(validation.errors.join(". "));
        }

        setParsedPayment(parsed);

        const resolved = await resolvePaymentAmount(parsed, {
          maxDiscrepancy: 0.05,
          throwOnPriceFailure: false,
        });

        setResolvedPayment(resolved);

        // If connected, check balance and prompt wallet immediately
        if (isConnected && address) {
          // Get public client for the payment's chain
          const publicClient = getPublicClient(config, {
            chainId: resolved.chainId,
          });

          if (!publicClient) {
            throw new Error(
              `Unsupported chain: ${CHAIN_NAMES[resolved.chainId] || resolved.chainId}`
            );
          }

          const requiredAmount = BigInt(resolved.resolvedValue);

          // Check balance before attempting transaction
          if (resolved.isERC20 && resolved.tokenAddress) {
            const tokenAddress = getAddress(resolved.tokenAddress);
            const balance = await publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [address],
            });

            console.log(
              "Token balance:",
              balance.toString(),
              "Required:",
              requiredAmount.toString()
            );

            if (balance < requiredAmount) {
              const symbol = resolved.symbol || "tokens";
              const decimals = resolved.decimals || 18;
              const balanceFormatted = formatUnits(balance, decimals);
              const requiredFormatted = formatUnits(requiredAmount, decimals);
              throw new Error(
                `Insufficient balance. You have ${balanceFormatted} ${symbol} but need ${requiredFormatted} ${symbol}.`
              );
            }
          } else {
            const balance = await publicClient.getBalance({ address });

            console.log(
              "Native balance:",
              balance.toString(),
              "Required:",
              requiredAmount.toString()
            );

            if (balance < requiredAmount) {
              const balanceFormatted = formatUnits(balance, 18);
              const requiredFormatted = formatUnits(requiredAmount, 18);
              throw new Error(
                `Insufficient balance. You have ${balanceFormatted} ETH but need ${requiredFormatted} ETH.`
              );
            }
          }

          // Balance is sufficient - prompt wallet immediately
          setScannerState("confirming");

          const toAddress = getAddress(
            resolved.isERC20 ? resolved.tokenAddress! : resolved.to
          );

          let calls: Array<{
            to: `0x${string}`;
            value?: bigint;
            data?: `0x${string}`;
          }>;

          if (!resolved.isERC20) {
            calls = [
              {
                to: toAddress,
                value: requiredAmount,
              },
            ];
          } else {
            const recipientAddress = getAddress(resolved.recipient!);
            const callData = encodeFunctionData({
              abi: parseAbi([
                "function transfer(address to, uint256 amount) returns (bool)",
              ]),
              functionName: "transfer",
              args: [recipientAddress, requiredAmount],
            });

            calls = [
              {
                to: toAddress,
                data: callData,
              },
            ];
          }

          sendCalls(
            { calls },
            {
              onSuccess: (result) => {
                console.log("Calls submitted:", result);
                const id = typeof result === "string" ? result : result.id;
                setCallsId(id);
                setScannerState("success");
              },
              onError: (err) => {
                console.error("Transaction failed:", err);
                const friendlyError = parseWalletError(err);
                setError(friendlyError);
                setScannerState("error");
              },
            }
          );
        } else {
          // Not connected - show preview to prompt connection
          setScannerState("preview");
        }
      } catch (err) {
        console.error("Failed to process QR code:", err);
        setError(
          err instanceof Error ? err.message : "Failed to process QR code"
        );
        setScannerState("error");
      }
    },
    [isConnected, address, config, sendCalls]
  );

  // Handle scan error
  const handleScanError = useCallback((errorMsg: string) => {
    console.error("Scan error:", errorMsg);
  }, []);

  // Handle wallet connection
  const handleConnect = useCallback(() => {
    if (portoConnector) {
      setScannerState("connecting");
      connect({ connector: portoConnector });
    } else {
      const firstConnector = connectors[0];
      if (firstConnector) {
        setScannerState("connecting");
        connect({ connector: firstConnector });
      } else {
        setError("No wallet connectors available");
        setScannerState("error");
      }
    }
  }, [connect, connectors, portoConnector]);

  // Handle payment confirmation using ERC-5792 sendCalls
  const handleConfirm = useCallback(async () => {
    if (!resolvedPayment || !isConnected || !address) {
      return;
    }

    setScannerState("confirming");
    setError(null);

    try {
      // Get public client for the payment's chain
      const publicClient = getPublicClient(config, {
        chainId: resolvedPayment.chainId,
      });

      if (!publicClient) {
        throw new Error(
          `Unsupported chain: ${CHAIN_NAMES[resolvedPayment.chainId] || resolvedPayment.chainId}`
        );
      }

      const requiredAmount = BigInt(resolvedPayment.resolvedValue);

      // Check balance before attempting transaction
      if (resolvedPayment.isERC20 && resolvedPayment.tokenAddress) {
        // ERC-20 balance check
        const tokenAddress = getAddress(resolvedPayment.tokenAddress);

        const balance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        });

        console.log("Token balance:", balance.toString(), "Required:", requiredAmount.toString());

        if (balance < requiredAmount) {
          const symbol = resolvedPayment.symbol || "tokens";
          const decimals = resolvedPayment.decimals || 18;
          const balanceFormatted = formatUnits(balance, decimals);
          const requiredFormatted = formatUnits(requiredAmount, decimals);
          throw new Error(
            `Insufficient balance. You have ${balanceFormatted} ${symbol} but need ${requiredFormatted} ${symbol}.`
          );
        }
      } else {
        // Native token balance check
        const balance = await publicClient.getBalance({ address });

        console.log("Native balance:", balance.toString(), "Required:", requiredAmount.toString());

        if (balance < requiredAmount) {
          const balanceFormatted = formatUnits(balance, 18);
          const requiredFormatted = formatUnits(requiredAmount, 18);
          throw new Error(
            `Insufficient balance. You have ${balanceFormatted} ETH but need ${requiredFormatted} ETH.`
          );
        }
      }

      const toAddress = getAddress(
        resolvedPayment.isERC20
          ? resolvedPayment.tokenAddress!
          : resolvedPayment.to
      );

      let calls: Array<{
        to: `0x${string}`;
        value?: bigint;
        data?: `0x${string}`;
      }>;

      if (!resolvedPayment.isERC20) {
        calls = [
          {
            to: toAddress,
            value: requiredAmount,
          },
        ];
      } else {
        const recipientAddress = getAddress(resolvedPayment.recipient!);
        const data = encodeFunctionData({
          abi: parseAbi([
            "function transfer(address to, uint256 amount) returns (bool)",
          ]),
          functionName: "transfer",
          args: [recipientAddress, requiredAmount],
        });

        calls = [
          {
            to: toAddress,
            data,
          },
        ];
      }

      sendCalls(
        { calls },
        {
          onSuccess: (result) => {
            console.log("Calls submitted:", result);
            const id = typeof result === "string" ? result : result.id;
            setCallsId(id);
            setScannerState("success");
          },
          onError: (err) => {
            console.error("Transaction failed:", err);
            const friendlyError = parseWalletError(err);
            setError(friendlyError);
            setScannerState("error");
          },
        }
      );
    } catch (err) {
      console.error("Failed to send transaction:", err);
      const friendlyError =
        err instanceof Error ? err.message : "Transaction failed";
      setError(friendlyError);
      setScannerState("error");
    }
  }, [resolvedPayment, isConnected, address, config, sendCalls]);

  // Handle cancel/reset scanner
  const handleCancelScanner = useCallback(() => {
    setScannedData(null);
    setParsedPayment(null);
    setResolvedPayment(null);
    setError(null);
    setCallsId(null);
    setScannerState("scanning");
  }, []);

  // Close scanner and return to home
  const closeScanner = useCallback(() => {
    handleCancelScanner();
    setView("home");
  }, [handleCancelScanner]);

  // Open scanner
  const openScanner = useCallback(() => {
    handleCancelScanner();
    setView("scanner");
  }, [handleCancelScanner]);

  // Update state when connection status changes
  useEffect(() => {
    if (isConnected && scannerState === "connecting") {
      setScannerState("preview");
    }
  }, [isConnected, scannerState]);

  // Copy calls ID to clipboard
  const copyCallsId = useCallback(() => {
    if (callsId) {
      navigator.clipboard.writeText(callsId);
    }
  }, [callsId]);

  // If not connected, show connect screen
  if (!isConnected) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">Porto Wallet</h1>
            <p className="text-muted-foreground">
              Connect your Porto wallet to get started
            </p>
          </div>
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect Wallet"
            )}
          </Button>
          <Link
            href="/"
            className="block text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  // Home view
  if (view === "home") {
    return (
      <main className="min-h-screen bg-background">
        {/* Header */}
        <header className="px-4 py-4">
          <div className="max-w-md mx-auto flex items-center justify-between">
            {/* Avatar + Address */}
            <button
              onClick={copyAddress}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
              <div className="flex items-center gap-1">
                <span className="font-mono text-sm">
                  {truncateAddress(address, 4, 4)}
                </span>
                {copied ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Scan Button */}
            <button
              onClick={openScanner}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <QrCode className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Balance */}
        <div className="px-4 py-8">
          <div className="max-w-md mx-auto">
            <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
            {isLoadingBalance ? (
              <div className="h-12 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <p className="text-4xl font-bold">
                {formatUsd(balanceUsd.toString())}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {formattedBalance} {ARBITRUM_USDC.symbol} on Arbitrum
            </p>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="px-4">
          <div className="max-w-md mx-auto">
            <h2 className="font-semibold mb-4">Spends</h2>

            {transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No recent transactions</p>
                <p className="text-xs mt-1">
                  Scan a payment QR code to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {tx.merchant.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{tx.merchant}</p>
                      <p className="text-xs text-muted-foreground">{tx.date}</p>
                    </div>
                    <p className="font-medium text-right">-${tx.amountUsd}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <button
              onClick={() => disconnect()}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Disconnect
            </button>
            <p className="text-xs text-muted-foreground">
              Powered by{" "}
              <a
                href="https://porto.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Porto
              </a>
            </p>
          </div>
        </footer>
      </main>
    );
  }

  // Scanner view
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={closeScanner}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h1 className="text-lg font-semibold">Scan to Pay</h1>

          <div className="w-5" /> {/* Spacer */}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-md mx-auto p-4">
        {/* Scanning State */}
        {scannerState === "scanning" && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground">
                Scan a payment code
              </p>
            </div>

            <QRScanner
              onScan={handleScan}
              onError={handleScanError}
              className="rounded-lg overflow-hidden"
            />

            {/* Manual input options */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  const url = prompt("Paste payment URL:");
                  if (url) handleScan(url);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Copy className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Paste URL</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {scannerState === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Processing payment...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Fetching current prices
            </p>
          </div>
        )}

        {/* Preview State */}
        {scannerState === "preview" && resolvedPayment && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-semibold">Confirm Payment</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Review the details below
              </p>
            </div>

            <PaymentPreview
              payment={resolvedPayment}
              onConfirm={handleConfirm}
              onCancel={handleCancelScanner}
              isLoading={isSending}
            />
          </div>
        )}

        {/* Connecting State */}
        {scannerState === "connecting" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Wallet className="w-12 h-12 text-primary mb-4 animate-pulse" />
            <p className="text-muted-foreground">Connecting wallet...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Please approve the connection request
            </p>
          </div>
        )}

        {/* Confirming State */}
        {scannerState === "confirming" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Confirming transaction...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Please approve in your wallet
            </p>
          </div>
        )}

        {/* Success State */}
        {scannerState === "success" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Payment Sent!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Your transaction has been submitted
            </p>

            {callsId && (
              <div className="w-full bg-muted/50 rounded-lg p-3 mb-6">
                <p className="text-xs text-muted-foreground mb-1">
                  Transaction ID
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono flex-1 truncate">
                    {callsId}
                  </code>
                  <button
                    onClick={copyCallsId}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={handleCancelScanner}
                className="flex-1"
              >
                Scan Another
              </Button>
              <Button onClick={closeScanner} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {scannerState === "error" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground text-center mb-4 max-w-xs">
              {error || "An unexpected error occurred"}
            </p>

            {resolvedPayment && (
              <div className="text-xs text-muted-foreground text-center mb-4">
                Chain:{" "}
                {CHAIN_NAMES[resolvedPayment.chainId] ||
                  `Chain ${resolvedPayment.chainId}`}
              </div>
            )}

            {error?.includes("Insufficient funds") && (
              <div className="bg-muted/50 rounded-lg p-3 mb-4 w-full">
                <p className="text-xs text-muted-foreground text-center">
                  Need funds?{" "}
                  <a
                    href="https://porto.sh"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Add funds to your Porto wallet
                  </a>
                </p>
              </div>
            )}

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={handleCancelScanner}
                className="flex-1"
              >
                Try Again
              </Button>
              <Button variant="outline" onClick={closeScanner} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
