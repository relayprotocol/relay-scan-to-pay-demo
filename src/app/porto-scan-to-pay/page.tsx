"use client";

/**
 * Porto Scan-to-Pay Page
 *
 * A dedicated page for scanning EIP-681 payment QR codes and completing
 * transactions using Porto wallet. Features:
 * - QR code scanning with device camera
 * - Robust EIP-681 parsing (fixes MetaMask bugs)
 * - USD amount support (EIP-681 extension)
 * - Price conversion via Relay API
 * - Porto wallet integration using ERC-5792 (wallet_sendCalls)
 */

import { useState, useCallback, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSendCalls } from "wagmi";
import { getAddress, encodeFunctionData, parseAbi } from "viem";
import Link from "next/link";
import {
  ArrowLeft,
  Wallet,
  QrCode,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Copy,
  ExternalLink,
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

/**
 * Parse Porto/wallet errors into user-friendly messages
 */
function parseWalletError(error: Error): string {
  const message = error.message || "";

  // Check for simulation/revert errors (insufficient funds)
  if (
    message.includes("revertData") ||
    message.includes("simulation") ||
    message.includes("Simulation") ||
    message.includes("insufficient") ||
    message.includes("Insufficient")
  ) {
    return "Insufficient funds. Please make sure your wallet has enough balance to cover the payment and gas fees.";
  }

  // Check for user rejection
  if (
    message.includes("rejected") ||
    message.includes("denied") ||
    message.includes("cancelled") ||
    message.includes("User rejected")
  ) {
    return "Transaction was cancelled.";
  }

  // Check for network errors
  if (
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("timeout")
  ) {
    return "Network error. Please check your connection and try again.";
  }

  // Check for chain mismatch
  if (message.includes("chain") && message.includes("switch")) {
    return "Please switch to the correct network in your wallet.";
  }

  // Default: return original message but clean it up
  if (message.length > 200) {
    return message.slice(0, 200) + "...";
  }

  return message || "Transaction failed. Please try again.";
}

type PageState =
  | "scanning"
  | "loading"
  | "preview"
  | "connecting"
  | "confirming"
  | "success"
  | "error";

export default function PortoScanToPayPage() {
  const [state, setState] = useState<PageState>("scanning");
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [parsedPayment, setParsedPayment] = useState<ParsedPayment | null>(null);
  const [resolvedPayment, setResolvedPayment] = useState<ResolvedPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callsId, setCallsId] = useState<string | null>(null);

  // Wagmi hooks for Porto
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  // Use ERC-5792 sendCalls for Porto compatibility
  const { mutate: sendCalls, mutateAsync: sendCallsAsync, isPending: isSending } = useSendCalls();

  // Find Porto connector
  const portoConnector = connectors.find(
    (c) => c.name.toLowerCase().includes("porto") || c.id === "porto"
  );

  // Handle QR scan result
  const handleScan = useCallback(async (data: string) => {
    console.log("Scanned QR code:", data);
    setScannedData(data);
    setState("loading");
    setError(null);

    try {
      // Parse the EIP-681 URI
      const parsed = parseEIP681(data);

      if (!parsed) {
        throw new Error(
          "Invalid QR code format. Expected an Ethereum payment URI (EIP-681)."
        );
      }

      // Validate the parsed payment
      const validation = validatePayment(parsed);
      if (!validation.valid) {
        throw new Error(validation.errors.join(". "));
      }

      setParsedPayment(parsed);

      // Resolve amounts with Relay price API
      const resolved = await resolvePaymentAmount(parsed, {
        maxDiscrepancy: 0.05,
        throwOnPriceFailure: false,
      });

      setResolvedPayment(resolved);
      setState("preview");
    } catch (err) {
      console.error("Failed to process QR code:", err);
      setError(err instanceof Error ? err.message : "Failed to process QR code");
      setState("error");
    }
  }, []);

  // Handle scan error
  const handleScanError = useCallback((errorMsg: string) => {
    console.error("Scan error:", errorMsg);
    // Don't show error for camera issues during scanning - QRScanner handles that
  }, []);

  // Handle wallet connection
  const handleConnect = useCallback(() => {
    if (portoConnector) {
      setState("connecting");
      connect({ connector: portoConnector });
    } else {
      // Fallback to first available connector if Porto not found
      const firstConnector = connectors[0];
      if (firstConnector) {
        setState("connecting");
        connect({ connector: firstConnector });
      } else {
        setError("No wallet connectors available");
        setState("error");
      }
    }
  }, [connect, connectors, portoConnector]);

  // Handle payment confirmation using ERC-5792 sendCalls
  const handleConfirm = useCallback(async () => {
    if (!resolvedPayment || !isConnected) {
      return;
    }

    setState("confirming");
    setError(null);

    try {
      // Normalize addresses to proper checksum format
      const toAddress = getAddress(
        resolvedPayment.isERC20
          ? resolvedPayment.tokenAddress!
          : resolvedPayment.to
      );

      // Build the calls array for ERC-5792
      let calls: Array<{ to: `0x${string}`; value?: bigint; data?: `0x${string}` }>;

      if (!resolvedPayment.isERC20) {
        // Native ETH transfer
        calls = [
          {
            to: toAddress,
            value: BigInt(resolvedPayment.resolvedValue),
          },
        ];
      } else {
        // ERC-20 transfer - encode the transfer function call
        const recipientAddress = getAddress(resolvedPayment.recipient!);
        const data = encodeFunctionData({
          abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
          functionName: "transfer",
          args: [recipientAddress, BigInt(resolvedPayment.resolvedValue)],
        });

        calls = [
          {
            to: toAddress,
            data,
          },
        ];
      }

      // Send using ERC-5792 wallet_sendCalls
      sendCalls(
        { calls },
        {
          onSuccess: (result) => {
            console.log("Calls submitted:", result);
            // Result is an object with { id: string }
            const id = typeof result === "string" ? result : result.id;
            setCallsId(id);
            setState("success");
          },
          onError: (err) => {
            console.error("Transaction failed:", err);
            const friendlyError = parseWalletError(err);
            setError(friendlyError);
            setState("error");
          },
        }
      );
    } catch (err) {
      console.error("Failed to send transaction:", err);
      const friendlyError = err instanceof Error ? parseWalletError(err) : "Transaction failed";
      setError(friendlyError);
      setState("error");
    }
  }, [resolvedPayment, isConnected, sendCalls]);

  // Handle cancel/reset
  const handleCancel = useCallback(() => {
    setScannedData(null);
    setParsedPayment(null);
    setResolvedPayment(null);
    setError(null);
    setCallsId(null);
    setState("scanning");
  }, []);

  // Update state when connection status changes
  useEffect(() => {
    if (isConnected && state === "connecting") {
      setState("preview");
    }
  }, [isConnected, state]);

  // Copy calls ID to clipboard
  const copyCallsId = useCallback(() => {
    if (callsId) {
      navigator.clipboard.writeText(callsId);
    }
  }, [callsId]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </Link>

          <h1 className="text-lg font-semibold">Porto Pay</h1>

          {/* Wallet status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <button
                onClick={() => disconnect()}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-mono text-xs">
                  {truncateAddress(address, 4, 4)}
                </span>
              </button>
            ) : (
              <div className="w-16" /> // Spacer for alignment
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-md mx-auto p-4">
        {/* Scanning State */}
        {state === "scanning" && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <QrCode className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <h2 className="text-xl font-semibold">Scan Payment QR</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Scan an Ethereum payment QR code to continue
              </p>
            </div>

            <QRScanner
              onScan={handleScan}
              onError={handleScanError}
              className="rounded-lg overflow-hidden"
            />

            {/* Manual input option */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">
                Or paste a payment URI
              </p>
              <input
                type="text"
                placeholder="ethereum:0x..."
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const value = (e.target as HTMLInputElement).value;
                    if (value) handleScan(value);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Loading State */}
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Processing payment...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Fetching current prices
            </p>
          </div>
        )}

        {/* Preview State */}
        {state === "preview" && resolvedPayment && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-semibold">Confirm Payment</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Review the details below
              </p>
            </div>

            <PaymentPreview
              payment={resolvedPayment}
              onConfirm={isConnected ? handleConfirm : handleConnect}
              onCancel={handleCancel}
              isLoading={isSending || isConnecting}
            />

            {!isConnected && (
              <p className="text-center text-sm text-muted-foreground">
                Connect your wallet to complete payment
              </p>
            )}
          </div>
        )}

        {/* Connecting State */}
        {state === "connecting" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Wallet className="w-12 h-12 text-primary mb-4 animate-pulse" />
            <p className="text-muted-foreground">Connecting wallet...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Please approve the connection request
            </p>
          </div>
        )}

        {/* Confirming State */}
        {state === "confirming" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Confirming transaction...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Please approve in your wallet
            </p>
          </div>
        )}

        {/* Success State */}
        {state === "success" && (
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

            <Button onClick={handleCancel} className="w-full">
              Scan Another Code
            </Button>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground text-center mb-4 max-w-xs">
              {error || "An unexpected error occurred"}
            </p>

            {/* Show chain info if we have a parsed payment */}
            {resolvedPayment && (
              <div className="text-xs text-muted-foreground text-center mb-4">
                Chain: {CHAIN_NAMES[resolvedPayment.chainId] || `Chain ${resolvedPayment.chainId}`}
              </div>
            )}

            {/* Show helpful link for insufficient funds */}
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
              <Button variant="outline" onClick={handleCancel} className="flex-1">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-md mx-auto">
          <p className="text-xs text-center text-muted-foreground">
            Powered by{" "}
            <a
              href="https://porto.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Porto
            </a>{" "}
            &{" "}
            <a
              href="https://relay.link"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Relay
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
