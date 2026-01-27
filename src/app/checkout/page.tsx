"use client";

import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { formatUnits, type WalletClient } from "viem";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useWalletClient } from "wagmi";
import { useQuote } from "@relayprotocol/relay-kit-hooks";
import { getClient, adaptViemWallet, type ProgressData } from "@relayprotocol/relay-sdk";
import { useRelayChains } from "@/providers";
import { useRelayCurrencies } from "@/hooks/useRelayCurrencies";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import {
  AddressDisplay,
  TokenSelectorModal,
  LoadingSpinner,
} from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { Currency } from "@/lib/relay";
import { getErrorMessage, formatUsd } from "@/lib/utils";

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

type PaymentStatus =
  | "idle"
  | "quoting"
  | "approving"
  | "processing"
  | "success"
  | "error";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const intentParam = searchParams.get("intent");
  const { chains } = useRelayChains();

  // Privy hooks
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();

  // Get the active Privy wallet (first one is usually the active one)
  const activePrivyWallet = wallets[0];

  // Wagmi wallet client - synced with Privy's active wallet
  const { data: walletClient } = useWalletClient();
  const walletAddress = walletClient?.account?.address;

  // Sync Privy's active wallet with wagmi
  useEffect(() => {
    if (activePrivyWallet) {
      setActiveWallet(activePrivyWallet);
    }
  }, [activePrivyWallet, setActiveWallet]);

  // Payment state
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);

  // Ref to capture the requestId when transaction starts (before quote refreshes)
  const executedRequestIdRef = useRef<string | null>(null);

  // Payment token selection
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [selectedPaymentChainId, setSelectedPaymentChainId] = useState<
    number | null
  >(null);
  const [selectedPaymentCurrency, setSelectedPaymentCurrency] =
    useState<Currency | null>(null);

  // Track if we're in the middle of a transaction (to disable quote fetching)
  const isTransacting =
    paymentStatus === "approving" || paymentStatus === "processing";

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

  // Get Relay client singleton
  const relayClient = getClient();

  // Build quote options only when we have all required params
  const quoteOptions = useMemo(() => {
    if (
      !paymentIntent ||
      !walletAddress ||
      !selectedPaymentChainId ||
      !selectedPaymentCurrency
    ) {
      return undefined;
    }

    return {
      user: walletAddress,
      originChainId: selectedPaymentChainId,
      originCurrency:
        selectedPaymentCurrency.address ||
        "0x0000000000000000000000000000000000000000",
      destinationChainId: paymentIntent.destinationChainId,
      destinationCurrency: paymentIntent.destinationCurrency,
      amount: paymentIntent.amount,
      recipient: paymentIntent.recipient,
      tradeType: paymentIntent.tradeType,
      referrer: "relay-scan-to-pay-demo",
    };
  }, [
    paymentIntent,
    walletAddress,
    selectedPaymentChainId,
    selectedPaymentCurrency,
  ]);

  // Use the useQuote hook from relay-kit-hooks
  const {
    data: quote,
    isLoading: isLoadingQuote,
    error: quoteError,
    executeQuote,
  } = useQuote(
    relayClient,
    walletClient ?? undefined,
    quoteOptions,
    undefined, // onRequest
    undefined, // onResponse
    {
      // Disable fetching while transacting to prevent quote changes mid-transaction
      enabled: !isTransacting && !!quoteOptions,
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: isTransacting ? false : 30 * 1000, // Refetch every 30s unless transacting
    },
    undefined, // onError
    undefined, // config
    undefined, // baseApiUrl
  );

  // Fetch currency info from Relay API for display
  const { data: currencies = [], isLoading: isLoadingCurrency } =
    useRelayCurrencies(
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

  // Get selected payment chain for display
  const selectedPaymentChain = useMemo(() => {
    if (!selectedPaymentChainId) return null;
    return chains.find((c) => c.id === selectedPaymentChainId);
  }, [chains, selectedPaymentChainId]);

  // Check balance of selected payment token
  const {
    balance: tokenBalance,
    formatted: formattedBalance,
    decimals: tokenDecimals,
    isLoading: isLoadingBalance,
  } = useTokenBalance({
    address: walletAddress,
    chainId: selectedPaymentChainId ?? undefined,
    tokenAddress: selectedPaymentCurrency?.address,
    decimals: selectedPaymentCurrency?.decimals,
    enabled: !!walletAddress && !!selectedPaymentChainId,
  });

  // Check if user has enough balance (compare with quote if available)
  const hasEnoughBalance = useMemo(() => {
    if (tokenBalance === undefined || !quote) return true; // Assume enough if we don't have data yet
    const requiredAmount = BigInt(quote.details?.currencyIn?.amount || "0");
    return tokenBalance >= requiredAmount;
  }, [tokenBalance, quote]);

  // Handle token selection
  const handleTokenSelect = useCallback(
    (chainId: number, currency: Currency) => {
      setSelectedPaymentChainId(chainId);
      setSelectedPaymentCurrency(currency);
    },
    [],
  );

  // Handle payment execution
  const handlePay = useCallback(async () => {
    // Validate we have everything we need
    if (!walletClient) {
      setErrorMessage("No wallet connected");
      return;
    }

    if (!quote) {
      setErrorMessage("No quote available");
      return;
    }

    if (!selectedPaymentChainId || !selectedPaymentCurrency) {
      setErrorMessage("Please select a payment token");
      return;
    }

    // Check balance
    if (tokenBalance !== undefined) {
      const requiredAmount = BigInt(quote.details?.currencyIn?.amount || "0");
      if (tokenBalance < requiredAmount) {
        setErrorMessage(
          `Insufficient balance. You need ${formatUnits(requiredAmount, tokenDecimals)} ${selectedPaymentCurrency.symbol} but only have ${formattedBalance}`,
        );
        return;
      }
    }

    // Capture the requestId before we start (quote may refresh during tx)
    executedRequestIdRef.current = quote.steps?.[0]?.requestId || null;

    // Reset state
    setPaymentStatus("approving");
    setErrorMessage(null);
    setCurrentStepId(null);

    try {
      // Adapt the wallet for Relay SDK
      const adaptedWallet = adaptViemWallet(walletClient as WalletClient);

      // Check if we need to switch chains
      const activeWalletChainId = await adaptedWallet.getChainId();
      const targetChainId = selectedPaymentChainId;

      if (targetChainId && targetChainId !== activeWalletChainId) {
        console.log(
          `Switching chain from ${activeWalletChainId} to ${targetChainId}`,
        );
        await adaptedWallet.switchChain(targetChainId);
      }

      // Execute the quote with progress tracking
      await executeQuote((progress: ProgressData) => {
        console.log("Relay progress:", progress);

        // Track current step for UI feedback
        if (progress.currentStep) {
          const stepId = progress.currentStep.id;
          setCurrentStepId(stepId);

          // Update status based on step type
          // Handle combined steps like "approve-and-deposit"
          if (stepId.includes("approve") && !stepId.includes("deposit")) {
            setPaymentStatus("approving");
          } else {
            // Any step that involves actual transaction (deposit, swap, send, approve-and-deposit, etc.)
            setPaymentStatus("processing");
          }
        }

        // Check for completion
        const allStepsComplete = progress.steps?.every(
          (step) =>
            step.items?.every((item) => item.status === "complete") ?? false,
        );
        if (allStepsComplete) {
          setPaymentStatus("success");
        }
      });

      // If we get here without error, mark as success
      setPaymentStatus("success");
    } catch (err) {
      console.error("Payment error:", err);
      setPaymentStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Payment failed");
    }
  }, [
    walletClient,
    quote,
    selectedPaymentChainId,
    selectedPaymentCurrency,
    tokenBalance,
    tokenDecimals,
    formattedBalance,
    executeQuote,
  ]);

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
          </div>
          <div className="flex flex-col gap-3 mt-4">
            {executedRequestIdRef.current && (
              <a
                href={`https://relay.link/transaction/${executedRequestIdRef.current}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                View on Relay
              </a>
            )}
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:underline"
            >
              Back to home
            </Link>
          </div>
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

              {/* Payment Method & Total */}
              <div className="border rounded-lg p-4 bg-card">
                <h2 className="font-medium mb-2">Payment method</h2>
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

                {/* Total & price breakdown */}
                {selectedPaymentCurrency && (
                  <div className="mt-4 pt-4 border-t">
                    {isLoadingQuote ? (
                      <div className="flex justify-between items-baseline">
                        <span className="text-base font-medium">Total</span>
                        <Skeleton className="h-7 w-20" />
                      </div>
                    ) : quoteError ? (
                      <p className="text-sm text-destructive">
                        {getErrorMessage(quoteError)}
                      </p>
                    ) : quote ? (
                      <>
                        {/* Total */}
                        <div className="flex justify-between items-baseline">
                          <span className="text-base font-medium">Total</span>
                          <span className="text-xl font-bold">
                            {formatUsd(quote.details?.currencyIn?.amountUsd)}
                          </span>
                        </div>
                        {/* Breakdown accordion */}
                        {quote.fees && (
                          <Accordion type="single" collapsible className="mt-1">
                            <AccordionItem value="fees" className="border-none">
                              <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
                                Breakdown
                              </AccordionTrigger>
                              <AccordionContent className="pb-0">
                                <div className="space-y-1.5 text-xs text-muted-foreground">
                                  {/* Item cost */}
                                  <div className="flex justify-between">
                                    <span>Item</span>
                                    <span>
                                      {formatUsd(
                                        quote.details?.currencyOut?.amountUsd,
                                      )}
                                    </span>
                                  </div>
                                  {/* Fees */}
                                  {quote.fees.gas?.amountUsd && (
                                    <div className="flex justify-between">
                                      <span>Network fee</span>
                                      <span>
                                        {formatUsd(quote.fees.gas.amountUsd)}
                                      </span>
                                    </div>
                                  )}
                                  {quote.fees.relayer?.amountUsd && (
                                    <div className="flex justify-between">
                                      <span>Relayer fee</span>
                                      <span>
                                        {formatUsd(
                                          quote.fees.relayer.amountUsd,
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {quote.fees.relayerGas?.amountUsd && (
                                    <div className="flex justify-between">
                                      <span>Relayer gas</span>
                                      <span>
                                        {formatUsd(
                                          quote.fees.relayerGas.amountUsd,
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {quote.fees.relayerService?.amountUsd && (
                                    <div className="flex justify-between">
                                      <span>Service fee</span>
                                      <span>
                                        {formatUsd(
                                          quote.fees.relayerService.amountUsd,
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}
                      </>
                    ) : null}
                  </div>
                )}

                {!hasEnoughBalance && selectedPaymentCurrency && quote && (
                  <p className="mt-2 text-xs text-destructive">
                    Insufficient balance for this payment
                  </p>
                )}
              </div>

              <button
                onClick={handlePay}
                disabled={
                  isTransacting ||
                  paymentStatus === "quoting" ||
                  !selectedPaymentCurrency ||
                  !quote ||
                  isLoadingQuote ||
                  (!hasEnoughBalance && !!quote) ||
                  isLoadingCurrency
                }
                className="w-full py-4 px-6 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingCurrency ? (
                  <Skeleton className="h-5 w-32 mx-auto bg-primary-foreground/20" />
                ) : isLoadingQuote ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner />
                    Getting quote...
                  </span>
                ) : paymentStatus === "approving" ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner />
                    Confirm in wallet...
                  </span>
                ) : paymentStatus === "processing" ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner />
                    Processing payment...
                  </span>
                ) : !selectedPaymentCurrency ? (
                  "Select payment method"
                ) : !quote ? (
                  "Select payment method"
                ) : (
                  "Pay now"
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

        {quote && (
          <details className="mt-2 text-xs overflow-hidden">
            <summary className="cursor-pointer text-muted-foreground">
              Debug: Quote Response
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
              {JSON.stringify(quote, null, 2)}
            </pre>
          </details>
        )}

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
