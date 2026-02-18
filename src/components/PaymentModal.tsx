"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, ArrowLeft, CheckCircle2, ExternalLink, Copy, Check } from "lucide-react";
import { useTransferTracking } from "@/hooks/useTransferTracking";
import { EXPLORER_URLS } from "@/lib/wallet/constants";

export interface Product {
  name: string;
  description: string;
  priceUsd: number;
  imageUrl: string;
}

// Base USDC constants
const RECIPIENT = "0x03508bB71268BBA25ECaCC8F620e01866650532c";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CHAIN_ID = 8453;
const USDC_DECIMALS = 6;

function generateEIP681Uri(
  tokenAddress: string,
  chainId: number,
  recipient: string,
  amount: string,
  usdAmount: string,
  merchantName?: string,
  description?: string,
  imageUrl?: string,
): string {
  const params = new URLSearchParams();
  params.set("address", recipient);
  params.set("uint256", amount);
  params.set("usdAmount", usdAmount);
  if (merchantName) params.set("merchantName", merchantName);
  if (description) params.set("description", description);
  if (imageUrl) params.set("imageUrl", imageUrl);
  return `ethereum:${tokenAddress}@${chainId}/transfer?${params.toString()}`;
}

interface PaymentModalProps {
  product: Product;
  onClose: () => void;
}

export function PaymentModal({ product, onClose }: PaymentModalProps) {
  // Calculate amount in USDC smallest unit (6 decimals)
  const amountSmallest = useMemo(
    () => Math.round(product.priceUsd * 10 ** USDC_DECIMALS).toString(),
    [product.priceUsd],
  );

  const eip681Uri = useMemo(
    () =>
      generateEIP681Uri(
        USDC_BASE,
        BASE_CHAIN_ID,
        RECIPIENT,
        amountSmallest,
        product.priceUsd.toFixed(2),
        "Demo Coffee Shop",
        product.description,
        product.imageUrl,
      ),
    [amountSmallest, product],
  );

  const { status, txHash } = useTransferTracking({
    recipientAddress: RECIPIENT,
    tokenAddress: USDC_BASE,
    chainId: BASE_CHAIN_ID,
    expectedAmount: amountSmallest,
    pollingInterval: 3000,
    isNative: false,
  });

  const explorerUrl = txHash
    ? `${EXPLORER_URLS[BASE_CHAIN_ID] || "https://basescan.org"}/tx/${txHash}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal panel */}
      <div className="relative w-full sm:max-w-sm bg-background rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {status === "success" ? (
          <SuccessView
            txHash={txHash}
            explorerUrl={explorerUrl}
            onClose={onClose}
          />
        ) : (
          <QRView
            product={product}
            eip681Uri={eip681Uri}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function QRView({
  product,
  eip681Uri,
  onClose,
}: {
  product: Product;
  eip681Uri: string;
  onClose: () => void;
}) {
  const [copiedUri, setCopiedUri] = useState(false);

  const handleCopyUri = async () => {
    await navigator.clipboard.writeText(eip681Uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  return (
    <div className="p-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold">Pay Demo Coffee Shop</h2>
        <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
      </div>

      {/* Amount */}
      <div className="text-center mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
          Amount
        </p>
        <p className="text-5xl font-bold">${product.priceUsd.toFixed(2)}</p>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center mb-6">
        <p className="text-sm font-medium mb-4">Scan in Wallet to Pay</p>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <QRCodeSVG value={eip681Uri} size={200} level="M" />
        </div>
      </div>

      {/* Copy URI */}
      <div className="flex justify-center mb-4">
        <button
          onClick={handleCopyUri}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
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

      {/* Waiting indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pb-2">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Waiting for payment...
      </div>
    </div>
  );
}

function SuccessView({
  txHash,
  explorerUrl,
  onClose,
}: {
  txHash: string | null;
  explorerUrl: string | null;
  onClose: () => void;
}) {
  return (
    <div className="p-6 space-y-5">
      {/* Icon + heading */}
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">Thank you for your purchase</h2>
        <p className="text-sm text-muted-foreground mt-2">
          We&apos;ve received your order and will ship in 5–7 business days.
        </p>
      </div>

      {/* View transaction link */}
      {explorerUrl && (
        <div className="text-center">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View transaction
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        className="w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
      >
        Close
      </button>
    </div>
  );
}
