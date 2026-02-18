"use client";

/**
 * Payment Preview Component
 *
 * Coinbase Pay-inspired design for payment confirmation.
 * Shows amount, payment method, and transaction details.
 */

import { useMemo } from "react";
import Image from "next/image";
import { AlertTriangle, ChevronRight, Loader2, Info, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, truncateAddress, formatUsd } from "@/lib/utils";
import { formatWeiToDisplay, CHAIN_NAMES } from "@/lib/wallet";
import { getChainSquaredIconUrl } from "@/lib/relay";
import type { ResolvedPayment, PaymentCurrency } from "@/lib/wallet";
import type { QuoteResponse } from "@/lib/relay";

interface PaymentPreviewProps {
  payment: ResolvedPayment;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  isQuoteLoading?: boolean;
  relayQuote?: QuoteResponse | null;
  className?: string;
  selectedCurrency?: PaymentCurrency | null;
  onChangeCurrency?: () => void;
  insufficientBalance?: boolean;
  insufficientGas?: boolean;
  isDirectSend?: boolean;
}

export function PaymentPreview({
  payment,
  onConfirm,
  onCancel,
  isLoading = false,
  isQuoteLoading = false,
  relayQuote = null,
  className,
  selectedCurrency,
  onChangeCurrency,
  insufficientBalance = false,
  insufficientGas = false,
  isDirectSend = true,
}: PaymentPreviewProps) {
  // Destination amount (what the merchant receives) — always USDC or the destination token
  const destinationAmount = useMemo(() => {
    return formatWeiToDisplay(payment.resolvedValue, payment.decimals);
  }, [payment.resolvedValue, payment.decimals]);

  // For Relay path: pull origin amounts directly from the quote's currencyIn
  const quoteCurrencyIn = relayQuote?.details?.currencyIn;
  const originAmountFormatted = quoteCurrencyIn?.amountFormatted;
  const originSymbol = quoteCurrencyIn?.currency?.symbol;
  const originAmountUsd = quoteCurrencyIn?.amountUsd
    ? parseFloat(quoteCurrencyIn.amountUsd).toFixed(2)
    : null;

  // Get chain name
  const chainName = CHAIN_NAMES[payment.chainId] || `Chain ${payment.chainId}`;

  // Get recipient address
  const recipientAddress = payment.isERC20
    ? payment.recipient || payment.to
    : payment.to;

  // Determine display values based on selected currency
  const displaySymbol = selectedCurrency?.symbol || payment.symbol;
  const displayChainName = selectedCurrency?.chainName || chainName;

  // Format balance for display
  const formattedBalance = selectedCurrency?.balance
    ? parseFloat(selectedCurrency.balance).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })
    : null;

  // USD total — use quote's currencyIn.amountUsd when available (includes swap fees),
  // fall back to the merchant's USD amount for direct sends
  const totalUsd = !isDirectSend && originAmountUsd
    ? originAmountUsd
    : payment.resolvedUsdAmount;

  return (
    <div className={cn("w-full", className)}>
      {/* Header with Icon */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <Coins className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">
          Pay {formatUsd(totalUsd)}
        </h2>
      </div>

      {/* Network & Route Badges */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Network:</span>
          <span className="font-medium">{displayChainName}</span>
        </div>
        <div className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
          isDirectSend
            ? "bg-green-500/10 text-green-700 dark:text-green-400"
            : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
        )}>
          {isDirectSend ? "Direct transfer" : "Via Relay"}
        </div>
      </div>

      {/* Warning Banner */}
      {payment.priceWarning && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {payment.priceWarning}
            </p>
          </div>
        </div>
      )}

      {/* Pay With Section */}
      <button
        onClick={onChangeCurrency}
        disabled={isLoading || isQuoteLoading || !onChangeCurrency}
        className="w-full p-4 bg-muted/50 hover:bg-muted rounded-xl border border-border transition-colors mb-4 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Token Icon with Chain Badge */}
            <div className="relative flex-shrink-0">
              {selectedCurrency?.logoURI ? (
                <Image
                  src={selectedCurrency.logoURI}
                  alt={displaySymbol}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {displaySymbol.slice(0, 2)}
                  </span>
                </div>
              )}
              {/* Chain badge */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded border border-border flex items-center justify-center">
                <Image
                  src={getChainSquaredIconUrl(selectedCurrency?.chainId || payment.chainId)}
                  alt=""
                  width={12}
                  height={12}
                  className="rounded-sm"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Pay with</span>
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedCurrency?.name || displaySymbol} on {displayChainName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {formattedBalance && (
              <div className="text-right">
                <div className="text-sm font-medium">
                  ${formattedBalance}
                </div>
                <div className="text-xs text-muted-foreground">Available</div>
              </div>
            )}
            {onChangeCurrency && (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* Transaction Details */}
      <div className="border border-border rounded-xl p-4 space-y-3 mb-4">
        {/* You pay — origin amount (from quote for Relay path, destination for direct) */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">You pay</span>
          {isQuoteLoading ? (
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          ) : !isDirectSend && originAmountFormatted && originSymbol ? (
            <span className="text-sm font-medium">
              {parseFloat(originAmountFormatted).toLocaleString(undefined, {
                maximumSignificantDigits: 6,
              })}{" "}
              {originSymbol}
            </span>
          ) : (
            <span className="text-sm font-medium">
              {destinationAmount} {payment.symbol}
            </span>
          )}
        </div>

        {/* Merchant receives — only show for Relay path so user knows the dest amount */}
        {!isDirectSend && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Merchant receives</span>
            {isQuoteLoading ? (
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            ) : (
              <span className="text-sm font-medium">
                {destinationAmount} {payment.symbol}
              </span>
            )}
          </div>
        )}

        {/* Recipient */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">To</span>
          <span className="text-sm font-mono">
            {truncateAddress(recipientAddress, 6, 4)}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="font-medium">Total</span>
          {isQuoteLoading ? (
            <div className="h-5 w-16 bg-muted animate-pulse rounded" />
          ) : (
            <span className="font-bold text-lg">
              {formatUsd(totalUsd)}
            </span>
          )}
        </div>
      </div>

      {/* Insufficient Balance Warning */}
      {insufficientBalance && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Insufficient balance to complete this payment.
            </p>
          </div>
        </div>
      )}

      {/* Insufficient Gas Warning */}
      {insufficientGas && !insufficientBalance && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Not enough ETH for gas on {displayChainName}. Fund your wallet with ETH to cover transaction fees.
            </p>
          </div>
        </div>
      )}

      {/* Pay Button */}
      <Button
        onClick={onConfirm}
        disabled={isLoading || isQuoteLoading || insufficientBalance || insufficientGas}
        className="w-full h-12 text-base font-medium rounded-xl mb-4"
        size="lg"
      >
        {isQuoteLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Calculating total...
          </>
        ) : isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processing payment...
          </>
        ) : insufficientBalance ? (
          "Insufficient balance"
        ) : insufficientGas ? (
          "Insufficient gas"
        ) : (
          "Pay now"
        )}
      </Button>

      {/* Security Disclaimer */}
      <p className="text-xs text-center text-muted-foreground mb-4 px-4">
        Sending funds is a permanent action. For your security, be sure you trust
        the merchant listed. Refunds are handled according to the merchant&apos;s
        refund policy.
      </p>

      {/* Cancel Link */}
      <button
        onClick={onCancel}
        disabled={isLoading}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

export default PaymentPreview;
