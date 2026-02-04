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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRScanner } from "@/components/porto/QRScanner";
import { PaymentPreview } from "@/components/porto/PaymentPreview";
import { CHAIN_NAMES } from "@/lib/porto/constants";
import type { ScannerState, PaymentCurrency } from "@/lib/porto/types";
import type { ResolvedPayment } from "@/lib/porto";

interface ScannerViewProps {
  scannerState: ScannerState;
  resolvedPayment: ResolvedPayment | null;
  error: string | null;
  callsId: string | null;
  isSending: boolean;
  selectedCurrency: PaymentCurrency | null;
  onScan: (data: string) => void;
  onScanError: (error: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
  onCopyCallsId: () => void;
  onChangeCurrency?: () => void;
}

export function ScannerView({
  scannerState,
  resolvedPayment,
  error,
  callsId,
  isSending,
  selectedCurrency,
  onScan,
  onScanError,
  onConfirm,
  onCancel,
  onClose,
  onCopyCallsId,
  onChangeCurrency,
}: ScannerViewProps) {
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
              <h2 className="text-xl font-semibold">Confirm Payment</h2>
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

        {/* Confirming State - Waiting for wallet approval */}
        {scannerState === "confirming" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Approve in your wallet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Review and confirm the transaction in Porto
            </p>
          </div>
        )}

        {/* Pending State - Transaction submitted, waiting for on-chain confirmation */}
        {scannerState === "pending" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Confirming on chain...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your transaction is being processed
            </p>
            {callsId && (
              <div className="mt-4 w-full bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  Transaction ID
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono flex-1 truncate">
                    {callsId}
                  </code>
                  <button
                    onClick={onCopyCallsId}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
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
                    onClick={onCopyCallsId}
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
