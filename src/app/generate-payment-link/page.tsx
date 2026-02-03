"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { parseUnits } from "viem";
import { useRelayChains } from "@/providers";
import {
  TokenSelectorModal,
  SelectedTokenButton,
} from "@/components/common";

import type { Currency } from "@/lib/relay";

// Payment intent data structure - encoded in payment link
interface PaymentIntent {
  destinationChainId: number;
  destinationCurrency: string;
  amount: string;
  recipient: string;
  merchantName: string;
  description?: string;
}

export default function GeneratePaymentLinkPage() {
  const { chains } = useRelayChains();

  // Form state
  const [merchantName, setMerchantName] = useState("Demo Coffee Shop");
  const [description, setDescription] = useState("Order payment");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);

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
      merchantName,
      description,
    };
  }, [
    selectedChainId,
    selectedCurrency,
    amountInSmallestUnit,
    recipientAddress,
    merchantName,
    description,
  ]);

  const handleTokenSelect = (chainId: number, currency: Currency) => {
    setSelectedChainId(chainId);
    setSelectedCurrency(currency);
    setShowTokenSelector(false);
  };

  // Create the pay URL
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const payUrl = paymentIntent
    ? `${baseUrl}/pay?intent=${encodeURIComponent(JSON.stringify(paymentIntent))}`
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

  const handleCopyLink = async () => {
    if (payUrl) {
      await navigator.clipboard.writeText(payUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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

        <h1 className="text-3xl font-bold mt-4 mb-2">Generate Payment Link</h1>
        <p className="text-muted-foreground mb-8">
          Configure the payment parameters. The generated link will create a
          checkout page with a deposit address and QR code for customers to pay.
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
          </div>

          {/* Payment Link Display */}
          <div className="flex flex-col items-center justify-start p-8 border rounded-lg bg-card">
            {isValid && paymentIntent ? (
              <div className="w-full space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold">
                    {amount} {selectedCurrency?.symbol}
                  </p>
                  <p className="text-sm text-muted-foreground">{merchantName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    on {selectedChain?.displayName || selectedChain?.name}
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium">
                    Payment Link
                  </label>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-xs font-mono break-all text-muted-foreground">
                      {payUrl}
                    </p>
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    {copied ? (
                      <>
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy Link
                      </>
                    )}
                  </button>
                  <a
                    href={payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 border border-input font-medium rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-2"
                  >
                    Open Checkout Page
                  </a>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Share this link with your customer. They will see a deposit
                  address and QR code to complete the payment.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm px-4">
                  Fill in all required fields to generate a payment link
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
