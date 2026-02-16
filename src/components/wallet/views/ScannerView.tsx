"use client";

/**
 * Scanner View Component
 *
 * Handles the QR scanning flow with state machine for different scanner states.
 */

import {
  X,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRScanner } from "@/components/wallet/QRScanner";
import { PaymentPreview } from "@/components/wallet/PaymentPreview";
import { CHAIN_NAMES, EXPLORER_URLS } from "@/lib/wallet/constants";
import type { ScannerState, PaymentCurrency } from "@/lib/wallet/types";
import type { ResolvedPayment } from "@/lib/wallet";

interface ScannerViewProps {
  scannerState: ScannerState;
  resolvedPayment: ResolvedPayment | null;
  error: string | null;
  isSending: boolean;
  selectedCurrency: PaymentCurrency | null;
  insufficientBalance: boolean;
  insufficientGas: boolean;
  relayRequestId: string | null;
  relayStatus: string | null;
  isDirectSend: boolean;
  directTxHash: string | null;
  txChainId: number | null;
  onScan: (data: string) => void;
  onScanError: (error: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
  onChangeCurrency?: () => void;
}

export function ScannerView({
  scannerState,
  resolvedPayment,
  error,
  isSending,
  selectedCurrency,
  insufficientBalance,
  insufficientGas,
  relayRequestId,
  relayStatus,
  isDirectSend,
  directTxHash,
  txChainId,
  onScan,
  onScanError,
  onConfirm,
  onCancel,
  onClose,
  onChangeCurrency,
}: ScannerViewProps) {
  // Human-readable Relay status
  const getRelayStatusText = (status: string | null) => {
    switch (status) {
      case "waiting":
        return "Waiting for deposit confirmation...";
      case "pending":
        return "Processing payment...";
      case "success":
        return "Payment complete!";
      case "failure":
        return "Payment failed";
      case "refund":
        return "Processing refund...";
      default:
        return "Processing payment...";
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={onClose}
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
              onScan={onScan}
              onError={onScanError}
              className="rounded-lg overflow-hidden"
            />

            {/* Manual input options */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  const url = prompt("Paste payment URL:");
                  if (url) onScan(url);
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
              {resolvedPayment.merchantName && (
                <h2 className="text-xl font-semibold">{resolvedPayment.merchantName}</h2>
              )}
              {resolvedPayment.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {resolvedPayment.description}
                </p>
              )}
              {!resolvedPayment.merchantName && (
                <h2 className="text-xl font-semibold">Confirm Payment</h2>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Review the details below
              </p>
            </div>

            <PaymentPreview
              payment={resolvedPayment}
              onConfirm={onConfirm}
              onCancel={onCancel}
              isLoading={isSending}
              selectedCurrency={selectedCurrency}
              onChangeCurrency={onChangeCurrency}
              insufficientBalance={insufficientBalance}
              insufficientGas={insufficientGas}
              isDirectSend={isDirectSend}
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

        {/* Confirming State - Sending transaction */}
        {scannerState === "confirming" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Sending transaction...</p>
          </div>
        )}

        {/* Pending State - Deposit sent, tracking Relay payment */}
        {scannerState === "pending" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full border-4 border-muted" />
              <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-t-primary animate-spin" />
            </div>
            <p className="font-medium">
              {getRelayStatusText(relayStatus)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This may take a moment
            </p>

            {relayRequestId && (
              <a
                href={`https://relay.link/transaction/${relayRequestId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                View payment
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Success State */}
        {scannerState === "success" && (() => {
          const explorerUrl = directTxHash && txChainId
            ? `${EXPLORER_URLS[txChainId] || "https://etherscan.io"}/tx/${directTxHash}`
            : null;

          return (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Payment Complete!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your payment has been confirmed
              </p>

              {/* Block explorer link for direct sends */}
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 mb-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                  View transaction
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {/* Relay link for cross-chain sends */}
              {!explorerUrl && relayRequestId && (
                <a
                  href={`https://relay.link/transaction/${relayRequestId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 mb-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                  View payment
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1"
                >
                  Scan Another
                </Button>
                <Button onClick={onClose} className="flex-1">
                  Done
                </Button>
              </div>
            </div>
          );
        })()}

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

            {relayRequestId && (
              <a
                href={`https://relay.link/transaction/${relayRequestId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                View payment details
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                Try Again
              </Button>
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default ScannerView;
