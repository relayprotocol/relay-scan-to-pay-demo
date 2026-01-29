"use client";

/**
 * Payment Preview Component
 *
 * Displays parsed EIP-681 payment data with USD conversion.
 * Shows all transaction details before user confirms.
 */

import { useMemo } from "react";
import { AlertTriangle, ArrowRight, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, truncateAddress, formatUsd } from "@/lib/utils";
import { formatWeiToDisplay } from "@/lib/porto";
import type { ResolvedPayment } from "@/lib/porto";

// Chain name lookup
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum",
  43114: "Avalanche",
  56: "BNB Chain",
  // Testnets
  11155111: "Sepolia",
  84532: "Base Sepolia",
};

interface PaymentPreviewProps {
  payment: ResolvedPayment;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

export function PaymentPreview({
  payment,
  onConfirm,
  onCancel,
  isLoading = false,
  className,
}: PaymentPreviewProps) {
  // Format the crypto amount for display
  const cryptoAmount = useMemo(() => {
    return formatWeiToDisplay(payment.resolvedValue, payment.decimals);
  }, [payment.resolvedValue, payment.decimals]);

  // Get chain name
  const chainName = CHAIN_NAMES[payment.chainId] || `Chain ${payment.chainId}`;

  // Get recipient address (for ERC-20 it's the recipient param, otherwise the `to` address)
  const recipientAddress = payment.isERC20
    ? payment.recipient || payment.to
    : payment.to;

  return (
    <div className={cn("w-full", className)}>
      {/* Amount Display */}
      <div className="text-center mb-6">
        {/* USD Amount (Primary) */}
        <div className="text-4xl font-bold text-foreground mb-1">
          {formatUsd(payment.resolvedUsdAmount)}
        </div>

        {/* Crypto Amount (Secondary) */}
        <div className="text-lg text-muted-foreground">
          {cryptoAmount} {payment.symbol}
        </div>

        {/* Exchange Rate */}
        <div className="text-sm text-muted-foreground mt-2">
          1 {payment.symbol} = {formatUsd(payment.tokenPrice.toString())}
        </div>
      </div>

      {/* Warning Banner */}
      {payment.priceWarning && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {payment.priceWarning}
            </p>
          </div>
        </div>
      )}

      {/* Transaction Details */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3 mb-6">
        {/* Recipient */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">To</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono">
              {truncateAddress(recipientAddress, 8, 6)}
            </span>
            <a
              href={`https://etherscan.io/address/${recipientAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Network */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Network</span>
          <span className="text-sm">{chainName}</span>
        </div>

        {/* Token (for ERC-20) */}
        {payment.isERC20 && payment.tokenAddress && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Token</span>
            <div className="flex items-center gap-2">
              <span className="text-sm">{payment.symbol}</span>
              <span className="text-xs text-muted-foreground font-mono">
                ({truncateAddress(payment.tokenAddress, 6, 4)})
              </span>
            </div>
          </div>
        )}

        {/* Gas (if specified) */}
        {payment.gas && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Gas Limit</span>
            <span className="text-sm">{payment.gas}</span>
          </div>
        )}

        {/* Price source indicator */}
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Price Source</span>
          <span className="text-xs text-muted-foreground">
            {payment.priceCalculated ? "Calculated from current rate" : "Relay API"}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Confirming...
            </>
          ) : (
            <>
              Pay {formatUsd(payment.resolvedUsdAmount)}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default PaymentPreview;
