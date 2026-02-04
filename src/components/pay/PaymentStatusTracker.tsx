"use client";

/**
 * Payment Status Tracker Component
 *
 * Polls Relay API for intent status and displays real-time updates.
 * Used on the POS pay page to show payment confirmation.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  RefreshCcw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useIntentStatus,
  getStatusDescription,
  isSuccessStatus,
  isFailureStatus,
  isTerminalStatus,
} from "@/hooks/useIntentStatus";
import type { IntentStatusValue } from "@/lib/relay";

interface PaymentStatusTrackerProps {
  requestId: string;
  eip681Uri: string;
  merchantName: string;
  usdAmount: string;
  amountFormatted: string;
  tokenSymbol: string;
  chainName: string;
  onReset?: () => void;
}

export function PaymentStatusTracker({
  requestId,
  eip681Uri,
  merchantName,
  usdAmount,
  amountFormatted,
  tokenSymbol,
  chainName,
  onReset,
}: PaymentStatusTrackerProps) {
  const [showQR, setShowQR] = useState(true);

  const {
    data: statusData,
    isLoading,
    error,
    refetch,
  } = useIntentStatus(requestId, {
    pollingInterval: 2000,
    stopOnTerminal: true,
  });

  const status = statusData?.status;

  // Hide QR code once payment is detected (not waiting anymore)
  useEffect(() => {
    if (status && status !== "waiting") {
      setShowQR(false);
    }
  }, [status]);

  // Format USD for display
  const formatUsd = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  // Get status icon
  const getStatusIcon = (s: IntentStatusValue) => {
    switch (s) {
      case "waiting":
        return <Clock className="w-6 h-6" />;
      case "pending":
      case "submitted":
      case "delayed":
        return <Loader2 className="w-6 h-6 animate-spin" />;
      case "success":
        return <CheckCircle2 className="w-6 h-6" />;
      case "failure":
        return <XCircle className="w-6 h-6" />;
      case "refund":
        return <Loader2 className="w-6 h-6 animate-spin" />;
      case "refunded":
        return <RefreshCcw className="w-6 h-6" />;
      default:
        return <AlertTriangle className="w-6 h-6" />;
    }
  };

  // Get status color classes
  const getStatusColor = (s: IntentStatusValue) => {
    switch (s) {
      case "success":
        return "text-green-600 bg-green-100";
      case "failure":
        return "text-red-600 bg-red-100";
      case "refund":
        return "text-yellow-600 bg-yellow-100";
      case "refunded":
        return "text-yellow-600 bg-yellow-100";
      case "delayed":
        return "text-orange-600 bg-orange-100";
      default:
        return "text-blue-600 bg-blue-100";
    }
  };

  // Success screen
  if (status && isSuccessStatus(status)) {
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
            {formatUsd(usdAmount)} received from customer
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
          {statusData?.inTxHashes?.[0] && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit Tx</span>
              <span className="font-mono text-xs">
                {statusData.inTxHashes[0].slice(0, 10)}...
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <a
            href={`https://relay.link/transaction/${requestId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            View on Relay
            <ExternalLink className="w-4 h-4" />
          </a>

          {onReset && (
            <Button variant="outline" onClick={onReset} className="w-full">
              New Payment
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Refund/Failure screen
  if (status && isFailureStatus(status)) {
    const isRefundStatus = status === "refund" || status === "refunded";
    const isRefundInProgress = status === "refund";

    return (
      <div className="text-center space-y-6">
        <div
          className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
            isRefundStatus ? "bg-yellow-100" : "bg-red-100"
          }`}
        >
          {isRefundInProgress ? (
            <Loader2 className="w-10 h-10 text-yellow-600 animate-spin" />
          ) : status === "refunded" ? (
            <RefreshCcw className="w-10 h-10 text-yellow-600" />
          ) : (
            <XCircle className="w-10 h-10 text-red-600" />
          )}
        </div>

        <div>
          <h2
            className={`text-2xl font-bold ${
              isRefundStatus ? "text-yellow-600" : "text-red-600"
            }`}
          >
            {isRefundInProgress
              ? "Processing Refund..."
              : status === "refunded"
                ? "Payment Refunded"
                : "Payment Failed"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {statusData?.details ||
              (isRefundInProgress
                ? "Your payment is being refunded."
                : "The payment could not be completed.")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <a
            href={`https://relay.link/transaction/${requestId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 border border-border font-medium rounded-lg hover:bg-muted transition-colors"
          >
            View Details on Relay
            <ExternalLink className="w-4 h-4" />
          </a>

          {onReset && (
            <Button onClick={onReset} className="w-full">
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Processing / Waiting screen (default)
  return (
    <div className="space-y-6">
      {/* Status indicator */}
      <div className="flex items-center justify-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            status ? getStatusColor(status) : "bg-muted text-muted-foreground"
          }`}
        >
          {isLoading && !status ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : status ? (
            getStatusIcon(status)
          ) : (
            <Clock className="w-5 h-5" />
          )}
        </div>
        <div>
          <p className="font-medium">
            {status ? getStatusDescription(status) : "Initializing..."}
          </p>
          {status && !isTerminalStatus(status) && (
            <p className="text-xs text-muted-foreground">
              Checking for updates...
            </p>
          )}
        </div>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <QRCodeSVG value={eip681Uri} size={200} level="M" />
          </div>
          <p className="text-sm font-medium mt-4">Scan with wallet</p>
          <p className="text-xs text-muted-foreground mt-2">
            Send {amountFormatted} {tokenSymbol} on {chainName}
          </p>
        </div>
      )}

      {/* Processing animation when not showing QR */}
      {!showQR && status && !isTerminalStatus(status) && (
        <div className="flex flex-col items-center py-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-t-primary animate-spin" />
          </div>
          <p className="mt-6 font-medium">{getStatusDescription(status)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {formatUsd(usdAmount)}
          </p>
        </div>
      )}

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
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Track on Relay link */}
      <div className="text-center">
        <a
          href={`https://relay.link/transaction/${requestId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
        >
          Track on Relay
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default PaymentStatusTracker;
