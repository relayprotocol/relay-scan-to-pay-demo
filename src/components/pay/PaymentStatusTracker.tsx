"use client";

/**
 * Payment Status Tracker Component
 *
 * Displays QR code and tracks incoming ERC-20 transfers to the merchant's address
 * via RPC polling (eth_getLogs). Works for both direct sends and Relay-routed payments.
 */

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import {
  useTransferTracking,
  type TransferStatus,
} from "@/hooks/useTransferTracking";
import { EXPLORER_URLS } from "@/lib/wallet/constants";

interface PaymentStatusTrackerProps {
  /** Merchant's recipient address (for transfer tracking) */
  recipientAddress: string;
  /** ERC-20 token contract address */
  tokenAddress: string;
  /** Destination chain ID */
  chainId: number;
  /** Expected amount in token's smallest unit */
  expectedAmount: string;
  /** EIP-681 URI encoded in QR code */
  eip681Uri: string;
  merchantName: string;
  usdAmount: string;
  amountFormatted: string;
  tokenSymbol: string;
  chainName: string;
  onReset?: () => void;
  /** Whether this is a native ETH transfer */
  isNative?: boolean;
}

export function PaymentStatusTracker({
  recipientAddress,
  tokenAddress,
  chainId,
  expectedAmount,
  eip681Uri,
  merchantName,
  usdAmount,
  amountFormatted,
  tokenSymbol,
  chainName,
  onReset,
  isNative = false,
}: PaymentStatusTrackerProps) {
  const [copiedUri, setCopiedUri] = useState(false);

  const handleCopyUri = async () => {
    await navigator.clipboard.writeText(eip681Uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const { status, txHash, error } = useTransferTracking({
    recipientAddress,
    tokenAddress,
    chainId,
    expectedAmount,
    pollingInterval: 3000,
    isNative,
  });

  // Format USD for display
  const formatUsd = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  // Build block explorer link for tx hash
  const explorerUrl = txHash
    ? `${EXPLORER_URLS[chainId] || "https://etherscan.io"}/tx/${txHash}`
    : null;

  // Success screen
  if (status === "success") {
    return (
      <div className="text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-green-600">
            Payment Complete!
          </h2>
          <p className="text-muted-foreground mt-2">
            {formatUsd(usdAmount)} received
          </p>
        </div>

        {/* Transaction details */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">
              {amountFormatted} {tokenSymbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Network</span>
            <span className="font-medium">{chainName}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              View transaction
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {onReset && (
            <button
              onClick={onReset}
              className="w-full py-3 px-4 border border-border font-medium rounded-lg hover:bg-muted transition-colors"
            >
              New Payment
            </button>
          )}
        </div>
      </div>
    );
  }

  // Waiting screen (default)
  return (
    <div className="space-y-6">
      {/* Status indicator */}
      <div className="flex items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-blue-600 bg-blue-100">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <p className="font-medium">Waiting for payment...</p>
          <p className="text-xs text-muted-foreground">
            Watching for incoming transfer
          </p>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center">
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <QRCodeSVG value={eip681Uri} size={200} level="M" />
        </div>
        <p className="text-sm font-medium mt-4">Scan with wallet</p>
        <p className="text-xs text-muted-foreground mt-2">
          Send {amountFormatted} {tokenSymbol} on {chainName}
        </p>
        <button
          onClick={handleCopyUri}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
        >
          {copiedUri ? (
            <>
              <Check className="w-3 h-3 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy payment URI
            </>
          )}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Error checking status
              </p>
              <p className="text-xs text-red-600 mt-1">
                {error.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentStatusTracker;
