"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatUnits, erc20Abi, type Address } from "viem";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useBalance, useReadContract, useWalletClient } from "wagmi";
import { getClient, adaptViemWallet } from "@relayprotocol/relay-sdk";
import { useRelayChains } from "@/providers";
import { useRelayCurrencies } from "@/hooks/useRelayCurrencies";
import { AddressDisplay, TokenSelectorModal } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import type { Currency } from "@/lib/relay";

// Payment intent structure (from QR code)
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

function CheckoutContent() {
  const searchParams = useSearchParams();
  const intentParam = searchParams.get("intent");
  const { chains } = useRelayChains();

  // Privy hooks
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();

  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "quoting" | "approving" | "processing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  // Payment token selection
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [selectedPaymentChainId, setSelectedPaymentChainId] = useState<
    number | null
  >(null);
  const [selectedPaymentCurrency, setSelectedPaymentCurrency] =
    useState<Currency | null>(null);

  // Quote state
  const [quote, setQuote] = useState<QuoteResponse | null>(null);

  // Parse payment intent from URL
  let paymentIntent: PaymentIntent | null = null;
  let parseError: string | null = null;

  if (intentParam) {
    try {
      paymentIntent = JSON.parse(decodeURIComponent(intentParam));
    } catch {
      parseError = "Invalid payment intent";
    }
  }

  // Fetch currency info from Relay API
  const { data: currencies = [], isLoading: isLoadingCurrency } = useRelayCurrencies(
    {
      chainIds: paymentIntent ? [paymentIntent.destinationChainId] : [],
      address: paymentIntent?.destinationCurrency,
      limit: 1,
    },
    !!paymentIntent?.destinationCurrency,
  );

  const currency = currencies[0];

  // Get chain info for display
  const destinationChain = useMemo(() => {
    if (!paymentIntent) return null;
    return chains.find((c) => c.id === paymentIntent.destinationChainId);
  }, [chains, paymentIntent]);

  // Format amount for display using viem
  const formattedAmount = useMemo(() => {
    if (!paymentIntent) return "0";
    const decimals = currency?.decimals || 18;
    return formatUnits(BigInt(paymentIntent.amount), decimals);
  }, [paymentIntent, currency]);

  const currencySymbol = currency?.symbol || "";

  // Get primary wallet
  const primaryWallet = wallets[0];
  const walletAddress = primaryWallet?.address as Address | undefined;

  // Get selected payment chain for display
  const selectedPaymentChain = useMemo(() => {
    if (!selectedPaymentChainId) return null;
    return chains.find((c) => c.id === selectedPaymentChainId);
  }, [chains, selectedPaymentChainId]);

  // Check balance of selected payment token
  const { data: balanceData, isLoading: isLoadingBalance } = useBalance({
    address: walletAddress,
    chainId: selectedPaymentChainId ?? undefined,
    token: selectedPaymentCurrency?.address
      ? (selectedPaymentCurrency.address as Address)
      : undefined,
    query: {
      enabled: !!walletAddress && !!selectedPaymentChainId,
    },
  });

  // Check if user has enough balance (compare with quote if available)
  const hasEnoughBalance = useMemo(() => {
    if (!balanceData || !quote) return true; // Assume enough if we don't have data yet
    const requiredAmount = BigInt(quote.details?.currencyIn?.amount || "0");
    return balanceData.value >= requiredAmount;
  }, [balanceData, quote]);

  // Format balance for display
  const formattedBalance = useMemo(() => {
    if (!balanceData) return null;
    return formatUnits(balanceData.value, balanceData.decimals);
  }, [balanceData]);

  // Handle token selection
  const handleTokenSelect = useCallback(
    (chainId: number, currency: Currency) => {
      setSelectedPaymentChainId(chainId);
      setSelectedPaymentCurrency(currency);
      setQuote(null); // Reset quote when token changes
    },
    [],
  );

  const handlePay = async () => {
    if (!paymentIntent || !primaryWallet || !walletAddress) return;
    if (!selectedPaymentChainId || !selectedPaymentCurrency) {
      setErrorMessage("Please select a payment token");
      return;
    }

    setPaymentStatus("quoting");
    setErrorMessage(null);
    setTxHash(null);
    setCurrentStep(null);

    try {
      // Get a viem wallet client from Privy
      const walletClient = await primaryWallet;

      // Create adapted wallet for Relay SDK
      const adaptedWallet = adaptViemWallet(walletClient);

      // Get fresh quote from Relay

      const quoteResponse = await relayClient.actions.getQuote({
        chainId: selectedPaymentChainId,
        toChainId: paymentIntent.destinationChainId,
        currency:
          selectedPaymentCurrency.address ||
          "0x0000000000000000000000000000000000000000",
        toCurrency: paymentIntent.destinationCurrency,
        tradeType: "EXACT_OUTPUT",
        amount: paymentIntent.amount,
        recipient: paymentIntent.recipient,
        wallet: adaptedWallet,
      });

      setQuote(quoteResponse);

      // Check balance against quote
      if (balanceData) {
        const requiredAmount = BigInt(
          quoteResponse.details?.currencyIn?.amount || "0",
        );
        if (balanceData.value < requiredAmount) {
          setPaymentStatus("error");
          setErrorMessage(
            `Insufficient balance. You need ${formatUnits(requiredAmount, balanceData.decimals)} ${selectedPaymentCurrency.symbol} but only have ${formattedBalance}`,
          );
          return;
        }
      }

      setPaymentStatus("approving");

      // Execute the transaction with progress tracking
      await relayClient.actions.execute({
        quote: quoteResponse,
        wallet: adaptedWallet,
        onProgress: (
          progress: Execute["onProgress"] extends (cb: infer P) => void
            ? P extends (data: infer D) => void
              ? D
              : never
            : never,
        ) => {
          console.log("Relay progress:", progress);

          // Track transaction hashes
          if (progress.txHashes && progress.txHashes.length > 0) {
            setTxHash(progress.txHashes[0].txHash);
          }

          // Track current step
          if (progress.currentStep) {
            const stepId = progress.currentStep.id;
            setCurrentStep(stepId);

            if (stepId === "approve") {
              setPaymentStatus("approving");
            } else if (stepId === "deposit" || stepId === "swap") {
              setPaymentStatus("processing");
            }
          }

          // Check for completion
          const allStepsComplete = progress.steps?.every(
            (step) => step.status === "complete",
          );
          if (allStepsComplete) {
            setPaymentStatus("success");
          }
        },
      });

      setPaymentStatus("success");
    } catch (err) {
      console.error("Payment error:", err);
      setPaymentStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Payment failed");
    }
  };

  // No intent provided
  if (!intentParam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">No Payment Intent</h1>
          <p className="text-muted-foreground">
            Scan a merchant QR code to start a payment.
          </p>
          <Link
            href="/generate-qr-code"
            className="text-primary hover:underline"
          >
            Generate a test QR code →
          </Link>
        </div>
      </div>
    );
  }

  // Parse error
  if (parseError || !paymentIntent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">
            Invalid Payment
          </h1>
          <p className="text-muted-foreground">
            {parseError || "Could not parse payment data"}
          </p>
          <Link href="/" className="text-primary hover:underline">
            Go back home →
          </Link>
        </div>
      </div>
    );
  }

  // Payment success
  if (paymentStatus === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-3xl text-green-600">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-green-600">
            Payment Complete!
          </h1>
          <p className="text-muted-foreground">
            Your payment of {formattedAmount} {currencySymbol} to{" "}
            {paymentIntent.merchantName} was successful.
          </p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Order ID: {paymentIntent.orderId}</p>
            <p className="flex items-center justify-center gap-1">
              Recipient: <AddressDisplay address={paymentIntent.recipient} />
            </p>
            {txHash && (
              <p className="flex items-center justify-center gap-1">
                Transaction: <AddressDisplay address={txHash} />
              </p>
            )}
          </div>
          <Link
            href="/"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Done
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-md mx-auto">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Cancel
        </Link>

        {/* Merchant Header */}
        <div className="mt-4 mb-6 text-center">
          <h1 className="text-2xl font-bold">{paymentIntent.merchantName}</h1>
          {paymentIntent.description && (
            <p className="text-muted-foreground">{paymentIntent.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Order {paymentIntent.orderId}
          </p>
        </div>

        {/* Payment Amount */}
        <div className="border rounded-lg p-6 bg-card text-center mb-6">
          <p className="text-sm text-muted-foreground mb-1">Amount Due</p>
          <div className="flex items-center justify-center gap-2">
            {isLoadingCurrency ? (
              <Skeleton className="w-8 h-8 rounded-full" />
            ) : currency?.metadata?.logoURI ? (
              <Image
                src={currency.metadata.logoURI}
                alt={currencySymbol}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : null}
            {isLoadingCurrency ? (
              <Skeleton className="h-10 w-48" />
            ) : (
              <p className="text-4xl font-bold">
                {formattedAmount} {currencySymbol}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
            on
            {destinationChain?.iconUrl && (
              <Image
                src={destinationChain.iconUrl}
                alt=""
                width={16}
                height={16}
                className="rounded-full"
              />
            )}
            {destinationChain?.displayName ||
              destinationChain?.name ||
              `Chain ${paymentIntent.destinationChainId}`}
          </p>
        </div>

        {/* Payment Details */}
        <div className="border rounded-lg p-4 bg-card space-y-3 mb-6">
          <h2 className="font-medium">Payment Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Recipient</span>
              <AddressDisplay address={paymentIntent.recipient} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network</span>
              <span>
                {destinationChain?.displayName ||
                  destinationChain?.name ||
                  paymentIntent.destinationChainId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Currency</span>
              {isLoadingCurrency ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                <span>{currencySymbol}</span>
              )}
            </div>
          </div>
        </div>

        {/* Wallet Connection / Payment */}
        <div className="space-y-4">
          {!ready ? (
            <div className="w-full py-4 text-center text-muted-foreground">
              Loading...
            </div>
          ) : !authenticated ? (
            <button
              onClick={login}
              className="w-full py-4 px-6 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Connect Wallet to Pay
            </button>
          ) : (
            <>
              {/* Connected Wallet */}
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-medium">Connected Wallet</h2>
                  <button
                    onClick={logout}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Disconnect
                  </button>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
                  <div className="flex-1">
                    {walletAddress && (
                      <AddressDisplay
                        address={walletAddress}
                        className="text-sm"
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {user?.email?.address || "Wallet connected"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pay With Selection */}
              <div className="border rounded-lg p-4 bg-card">
                <h2 className="font-medium mb-2">Pay with</h2>
                <button
                  onClick={() => setShowTokenSelector(true)}
                  className="w-full flex items-center gap-3 p-3 border rounded-md bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  {selectedPaymentCurrency ? (
                    <>
                      <div className="relative flex-shrink-0">
                        {selectedPaymentCurrency.metadata?.logoURI ? (
                          <Image
                            src={selectedPaymentCurrency.metadata.logoURI}
                            alt={selectedPaymentCurrency.symbol || ""}
                            width={32}
                            height={32}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                            {(selectedPaymentCurrency.symbol || "?").slice(
                              0,
                              2,
                            )}
                          </div>
                        )}
                        {selectedPaymentChain?.iconUrl && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-sm border border-border flex items-center justify-center">
                            <Image
                              src={selectedPaymentChain.iconUrl}
                              alt=""
                              width={12}
                              height={12}
                              className="rounded-sm"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {selectedPaymentCurrency.symbol}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          on{" "}
                          {selectedPaymentChain?.displayName ||
                            selectedPaymentChain?.name}
                          {isLoadingBalance ? (
                            " · Loading balance..."
                          ) : formattedBalance !== null ? (
                            <>
                              {" "}
                              · Balance: {Number(formattedBalance).toFixed(4)}
                            </>
                          ) : null}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-muted-foreground">
                          Select a token
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Choose your payment asset
                        </p>
                      </div>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Change →
                  </span>
                </button>
                {!hasEnoughBalance && selectedPaymentCurrency && quote && (
                  <p className="mt-2 text-xs text-destructive">
                    Insufficient balance for this payment
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Powered by Relay - pay with any asset
                </p>
              </div>

              <button
                onClick={handlePay}
                disabled={
                  paymentStatus === "quoting" ||
                  paymentStatus === "approving" ||
                  paymentStatus === "processing" ||
                  !selectedPaymentCurrency ||
                  (!hasEnoughBalance && !!quote) ||
                  isLoadingCurrency
                }
                className="w-full py-4 px-6 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingCurrency ? (
                  <Skeleton className="h-5 w-32 mx-auto bg-primary-foreground/20" />
                ) : paymentStatus === "quoting" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Getting quote...
                  </span>
                ) : paymentStatus === "approving" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Approve in wallet...
                  </span>
                ) : paymentStatus === "processing" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {currentStep
                      ? `Processing ${currentStep}...`
                      : "Processing payment..."}
                  </span>
                ) : !selectedPaymentCurrency ? (
                  "Select a payment token"
                ) : (
                  `Pay ${formattedAmount} ${currencySymbol}`
                )}
              </button>
            </>
          )}

          {errorMessage && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded-md text-destructive text-sm">
              {errorMessage}
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            By paying, you agree to the merchant&apos;s terms of service
          </p>
        </div>

        {/* Debug info */}
        <details className="mt-8 text-xs overflow-hidden">
          <summary className="cursor-pointer text-muted-foreground">
            Debug: Payment Intent
          </summary>
          <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
            {JSON.stringify(paymentIntent, null, 2)}
          </pre>
        </details>

        {/* Token Selector Modal */}
        <TokenSelectorModal
          open={showTokenSelector}
          onClose={() => setShowTokenSelector(false)}
          selectedChainId={selectedPaymentChainId}
          selectedCurrency={selectedPaymentCurrency}
          onSelect={handleTokenSelect}
        />
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p>Loading...</p>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
