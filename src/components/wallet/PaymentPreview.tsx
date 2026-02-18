"use client";

/**
 * Payment Preview Component
 *
 * Receipt-style payment confirmation.
 * Shows item image, description, amount, and payment method.
 */

import { useState, useMemo } from "react";
import Image from "next/image";
import { AlertTriangle, ChevronRight, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatUsd } from "@/lib/utils";
import { formatWeiToDisplay } from "@/lib/wallet";
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
  const [imgError, setImgError] = useState(false);

  // Destination amount (what the merchant receives)
  const destinationAmount = useMemo(() => {
    return formatWeiToDisplay(payment.resolvedValue, payment.decimals);
  }, [payment.resolvedValue, payment.decimals]);

  // For Relay path: pull origin amounts from the quote
  const quoteCurrencyIn = relayQuote?.details?.currencyIn;
  const originAmountFormatted = quoteCurrencyIn?.amountFormatted;
  const originSymbol = quoteCurrencyIn?.currency?.symbol;
  const originAmountUsd = quoteCurrencyIn?.amountUsd
    ? parseFloat(quoteCurrencyIn.amountUsd).toFixed(2)
    : null;

  const displaySymbol = selectedCurrency?.symbol || payment.symbol;

  const formattedBalance = selectedCurrency?.balance
    ? parseFloat(selectedCurrency.balance).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })
    : null;

  // USD total
  const totalUsd = !isDirectSend && originAmountUsd
    ? originAmountUsd
    : payment.resolvedUsdAmount;

  // Relay fee = what user pays minus what merchant receives (USD)
  const relayFeeUsd = useMemo(() => {
    if (isDirectSend || !originAmountUsd) return null;
    const fee = parseFloat(originAmountUsd) - parseFloat(payment.resolvedUsdAmount);
    return fee > 0 ? fee.toFixed(2) : null;
  }, [isDirectSend, originAmountUsd, payment.resolvedUsdAmount]);

  const hasImage = !!payment.imageUrl && !imgError;

  return (
    <div className={cn("w-full", className)}>
      {/* Title */}
      <div className="text-center mb-6">
        <p className="text-3xl font-bold">{formatUsd(totalUsd)}</p>
        {payment.merchantName && (
          <p className="text-sm text-muted-foreground mt-1">
            to {payment.merchantName}
          </p>
        )}
      </div>

      {/* Receipt Item Card */}
      {(payment.description || payment.imageUrl) && (
        <div className="border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            {/* Item image */}
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={payment.imageUrl!}
                  alt={payment.description || "Item"}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xl">
                  🛒
                </div>
              )}
            </div>

            {/* Item description */}
            <div className="flex-1 min-w-0">
              {payment.merchantName && (
                <p className="font-medium text-sm">{payment.merchantName}</p>
              )}
              {payment.description && (
                <p className="text-sm text-muted-foreground truncate">
                  {payment.description}
                </p>
              )}
            </div>

            {/* Item price */}
            <p className="font-semibold text-sm flex-shrink-0">
              {formatUsd(payment.resolvedUsdAmount)}
            </p>
          </div>

          {/* Fees (Relay path only) */}
          {!isDirectSend && (
            <div className="flex justify-between items-center mt-3 text-sm">
              <span className="text-muted-foreground">Fees</span>
              {isQuoteLoading ? (
                <div className="h-3 w-12 bg-muted animate-pulse rounded" />
              ) : relayFeeUsd ? (
                <span className="text-muted-foreground">{formatUsd(relayFeeUsd)}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          )}

          {/* Total */}
          <div className="border-t border-border mt-3 pt-3 flex justify-between items-center">
            <span className="text-sm font-medium">Total</span>
            {isQuoteLoading ? (
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <span className="font-bold">
                {formatUsd(totalUsd)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Pay With Selector */}
      <button
        onClick={onChangeCurrency}
        disabled={isLoading || isQuoteLoading || !onChangeCurrency}
        className="w-full p-4 bg-muted/50 hover:bg-muted rounded-xl border border-border transition-colors mb-4 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Token icon with chain badge */}
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
              {/* Show amount you'll pay */}
              <div className="text-sm text-muted-foreground">
                {isQuoteLoading ? (
                  <div className="h-3 w-24 bg-muted animate-pulse rounded inline-block" />
                ) : !isDirectSend && originAmountFormatted && originSymbol ? (
                  <>
                    {parseFloat(originAmountFormatted).toLocaleString(undefined, {
                      maximumSignificantDigits: 6,
                    })}{" "}
                    {originSymbol}
                  </>
                ) : (
                  <>
                    {destinationAmount} {payment.symbol}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {formattedBalance && (
              <div className="text-right">
                <div className="text-sm font-medium">
                  {formattedBalance} {displaySymbol}
                </div>
                <div className="text-xs text-muted-foreground">available</div>
              </div>
            )}
            {onChangeCurrency && (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* Warnings */}
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

      {insufficientGas && !insufficientBalance && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Not enough ETH for gas. Fund your wallet with ETH to cover transaction fees.
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

      {/* Cancel */}
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
