"use client";

/**
 * Payment Status Tracker Component
 *
 * Polls Relay API for intent status and displays real-time updates.
 * Used on the POS pay page to show payment confirmation.
 */

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  RefreshCcw,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRelayTracking, type RelayRequest } from "@/hooks/useRelayTracking";

type RelayStatus = NonNullable<RelayRequest["status"]>;

const TERMINAL_STATUSES: RelayStatus[] = ["success", "failure", "refund"];

function isTerminalStatus(s: RelayStatus): boolean {
  return TERMINAL_STATUSES.includes(s);
}

function getStatusDescription(s: RelayStatus): string {
  switch (s) {
    case "waiting":
      return "Waiting for payment...";
    case "pending":
      return "Payment received, processing...";
    case "success":
      return "Payment complete!";
    case "refund":
      return "Processing refund...";
    case "failure":
      return "Payment failed";
    default:
      return "Processing...";
  }
}

interface PaymentStatusTrackerProps {
  depositAddress: string | null;
  eip681Uri: string;
  merchantName: string;
  usdAmount: string;
  amountFormatted: string;
  tokenSymbol: string;
  chainName: string;
  onReset?: () => void;
}

export function PaymentStatusTracker({
  depositAddress,
  eip681Uri,
  merchantName,
  usdAmount,
  amountFormatted,
  tokenSymbol,
  chainName,
  onReset,
}: PaymentStatusTrackerProps) {
  const [copiedUri, setCopiedUri] = useState(false);

  const handleCopyUri = async () => {
    await navigator.clipboard.writeText(eip681Uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const {
    data: relayRequest,
    isLoading,
    error,
    refetch,
  } = useRelayTracking(depositAddress, {
    pollingInterval: 2000,
    enabled: !!depositAddress,
  });

  const status = depositAddress ? relayRequest?.status : undefined;
  const requestId = depositAddress ? relayRequest?.id : undefined;

  // Show QR only while waiting for payment
  const showQR = !status || status === "waiting";

  // Format USD for display
  const formatUsd = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  // Get status icon
  const getStatusIcon = (s: RelayStatus) => {
    switch (s) {
      case "waiting":
        return <Clock className="w-6 h-6" />;
      case "pending":
        return <Loader2 className="w-6 h-6 animate-spin" />;
      case "success":
        return <CheckCircle2 className="w-6 h-6" />;
      case "failure":
        return <XCircle className="w-6 h-6" />;
      case "refund":
        return <RefreshCcw className="w-6 h-6" />;
      default:
        return <AlertTriangle className="w-6 h-6" />;
    }
  };

  // Get status color classes
  const getStatusColor = (s: RelayStatus) => {
    switch (s) {
      case "success":
        return "text-green-600 bg-green-100";
      case "failure":
        return "text-red-600 bg-red-100";
      case "refund":
        return "text-yellow-600 bg-yellow-100";
      default:
        return "text-blue-600 bg-blue-100";
    }
  };

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
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {requestId && (
            <a
              href={`https://relay.link/transaction/${requestId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              View payment
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

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
  if (status === "failure" || status === "refund") {
    const isRefund = status === "refund";

    return (
      <div className="text-center space-y-6">
        <div
          className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
            isRefund ? "bg-yellow-100" : "bg-red-100"
          }`}
        >
          {isRefund ? (
            <RefreshCcw className="w-10 h-10 text-yellow-600" />
          ) : (
            <XCircle className="w-10 h-10 text-red-600" />
          )}
        </div>

        <div>
          <h2
            className={`text-2xl font-bold ${
              isRefund ? "text-yellow-600" : "text-red-600"
            }`}
          >
            {isRefund ? "Payment Refunded" : "Payment Failed"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {isRefund
              ? "Your payment has been refunded."
              : "The payment could not be completed."}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {requestId && (
            <a
              href={`https://relay.link/transaction/${requestId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 border border-border font-medium rounded-lg hover:bg-muted transition-colors"
            >
              View payment details
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

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
            status ? getStatusColor(status) : "text-blue-600 bg-blue-100"
          }`}
        >
          {status ? getStatusIcon(status) : <Clock className="w-6 h-6" />}
        </div>
        <div>
          <p className="font-medium">
            {status ? getStatusDescription(status) : "Waiting for payment..."}
          </p>
          {(!status || !isTerminalStatus(status)) && (
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
      {requestId && (
        <div className="text-center">
          <a
            href={`https://relay.link/transaction/${requestId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            View payment
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

export default PaymentStatusTracker;
