"use client";

import { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { parseUnits } from "viem";
import { useRelayChains } from "@/providers";
import {
  TokenSelectorModal,
  SelectedTokenButton,
  AddressDisplay,
} from "@/components/common";

import type { Currency } from "@/lib/relay";

// Payment intent data structure - encoded in QR code
interface PaymentIntent {
  destinationChainId: number;
  destinationCurrency: string;
  amount: string;
  recipient: string;
  merchantId: string;
  merchantName: string;
  orderId: string;
  description?: string;
  tradeType: "EXACT_OUTPUT";
  createdAt: string;
}

function generateOrderId() {
  return `PAY-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export default function GenerateQRCodePage() {
  const { chains } = useRelayChains();

  // Form state
  const [merchantName, setMerchantName] = useState("Demo Coffee Shop");
  const [merchantId] = useState("merchant_001");
  const [description, setDescription] = useState("Order payment");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");

  // Token selection
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(
    null,
  );
  const [showTokenSelector, setShowTokenSelector] = useState(false);

  const selectedChain = useMemo(() => {
    return chains.find((c) => c.id === selectedChainId);
  }, [chains, selectedChainId]);

  // Convert amount to smallest unit
  const amountInSmallestUnit = useMemo(() => {
    if (!selectedCurrency || !amount) return "0";
    try {
      return parseUnits(amount, selectedCurrency.decimals || 18).toString();
    } catch {
      return "0";
    }
  }, [amount, selectedCurrency]);

  // Build the payment intent
  const paymentIntent: PaymentIntent | null = useMemo(() => {
    if (!selectedChainId || !selectedCurrency) return null;
    return {
      destinationChainId: selectedChainId,
      destinationCurrency: selectedCurrency.address || "",
      amount: amountInSmallestUnit,
      recipient: recipientAddress,
      merchantId,
      merchantName,
      orderId: generateOrderId(),
      description,
      tradeType: "EXACT_OUTPUT" as const,
      createdAt: new Date().toISOString(),
    };
  }, [
    selectedChainId,
    selectedCurrency,
    amountInSmallestUnit,
    recipientAddress,
    merchantId,
    merchantName,
    description,
  ]);

  // Create the checkout URL
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const checkoutUrl = paymentIntent
    ? `${baseUrl}/checkout?intent=${encodeURIComponent(JSON.stringify(paymentIntent))}`
    : "";

  // Validation
  const isValidAddress = recipientAddress.match(/^0x[a-fA-F0-9]{40}$/);
  const isValidAmount = parseFloat(amount) > 0;
  const isValid =
    isValidAddress &&
    isValidAmount &&
    selectedChainId &&
    selectedCurrency &&
    paymentIntent;

  const handleTokenSelect = (chainId: number, currency: Currency) => {
    setSelectedChainId(chainId);
    setSelectedCurrency(currency);
    setShowTokenSelector(false);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to Home
        </Link>

        <h1 className="text-3xl font-bold mt-4 mb-2">
          Generate Payment QR Code
        </h1>
        <p className="text-muted-foreground mb-8">
          Configure the Relay payment parameters. The QR code will direct
          customers to pay using any asset.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Configuration Form */}
          <div className="space-y-6">
            {/* Merchant Info */}
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Merchant Info</h2>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Merchant Name
                </label>
                <input
                  type="text"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  placeholder="Your Business Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  placeholder="Order payment"
                />
              </div>
            </div>

            {/* Payment Configuration */}
            <div className="space-y-4 border-t pt-6">
              <h2 className="font-semibold text-lg">Payment Configuration</h2>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Recipient Address <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md bg-background font-mono text-sm ${
                    recipientAddress && !isValidAddress
                      ? "border-destructive"
                      : "border-input"
                  }`}
                  placeholder="0x..."
                />
                {recipientAddress && !isValidAddress && (
                  <p className="text-xs text-destructive mt-1">
                    Please enter a valid Ethereum address
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Receive Token <span className="text-destructive">*</span>
                </label>
                <SelectedTokenButton
                  chain={selectedChain}
                  currency={selectedCurrency || undefined}
                  onClick={() => setShowTokenSelector(true)}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Select the chain and token you want to receive
                </p>
                <TokenSelectorModal
                  open={showTokenSelector}
                  onClose={() => setShowTokenSelector(false)}
                  selectedChainId={selectedChainId}
                  selectedCurrency={selectedCurrency}
                  onSelect={handleTokenSelect}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Amount ({selectedCurrency?.symbol || "Token"}){" "}
                  <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  placeholder="10.00"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            {/* Summary */}
            {isValid && (
              <div className="border-t pt-4 space-y-2 bg-muted/50 p-4 rounded-lg">
                <h3 className="font-medium">Payment Summary</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">
                      {amount} {selectedCurrency?.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chain</span>
                    <span>
                      {selectedChain?.displayName || selectedChain?.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Recipient</span>
                    <AddressDisplay
                      address={recipientAddress}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* QR Code Display */}
          <div className="flex flex-col items-center justify-start p-8 border rounded-lg bg-card">
            {isValid && paymentIntent ? (
              <>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <QRCodeSVG
                    value={checkoutUrl}
                    size={256}
                    level="M"
                    includeMargin
                  />
                </div>
                <p className="mt-4 text-lg font-semibold">
                  {amount} {selectedCurrency?.symbol}
                </p>
                <p className="text-sm text-muted-foreground">{merchantName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  on {selectedChain?.displayName || selectedChain?.name}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-48 h-48 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground text-sm px-4">
                    Fill in all required fields to generate QR code
                  </p>
                </div>
              </div>
            )}

            {/* Debug info */}
            {paymentIntent && (
              <details className="mt-6 text-xs w-full overflow-hidden">
                <summary className="cursor-pointer text-muted-foreground">
                  View payment intent (debug)
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                  {JSON.stringify(paymentIntent, null, 2)}
                </pre>
              </details>
            )}

            {isValid && (
              <details className="mt-2 text-xs w-full overflow-hidden">
                <summary className="cursor-pointer text-muted-foreground">
                  View checkout URL
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
                  {checkoutUrl}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
