import { Suspense } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { AddressDisplay } from "@/components/common";
import { PaymentStatusTracker } from "@/components/pay";
import { fetchQuote, type QuoteResponse } from "@/lib/relay";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Arbitrum USDC - the token users will send from
const ARBITRUM_USDC = {
  chainId: 42161,
  address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  symbol: "USDC",
  decimals: 6,
  chainName: "Arbitrum",
};

// Payment intent structure (from payment link)
interface PaymentIntent {
  destinationChainId: number;
  destinationCurrency: string;
  amount: string;
  recipient: string;
  merchantName: string;
  description?: string;
}

// Fetch deposit address quote from Relay API
async function getDepositQuote(
  paymentIntent: PaymentIntent,
): Promise<QuoteResponse | null> {
  try {
    return await fetchQuote(
      {
        user: paymentIntent.recipient,
        originChainId: ARBITRUM_USDC.chainId,
        originCurrency: ARBITRUM_USDC.address,
        destinationChainId: paymentIntent.destinationChainId,
        destinationCurrency: paymentIntent.destinationCurrency,
        amount: paymentIntent.amount,
        recipient: paymentIntent.recipient,
        refundTo: paymentIntent.recipient,
        tradeType: "EXACT_OUTPUT",
        useDepositAddress: true,
        referrer: "relay-scan-to-pay-demo",
      },
      60, // Cache for 60 seconds
    );
  } catch (error) {
    console.error("Failed to fetch deposit quote:", error);
    return null;
  }
}

// Generate EIP-681 URI for QR code
function generateEIP681Uri(
  depositAddress: string,
  amount: string,
  usdAmount: string,
): string {
  const params = new URLSearchParams();
  params.set("address", depositAddress);
  params.set("uint256", amount);
  params.set("usdAmount", usdAmount);

  return `ethereum:${ARBITRUM_USDC.address}@${ARBITRUM_USDC.chainId}/transfer?${params.toString()}`;
}

// Format USD amount
function formatUsd(amount: string | undefined): string {
  if (!amount) return "$0.00";
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

interface PayPageProps {
  searchParams: Promise<{ intent?: string }>;
}

async function PayContent({ searchParams }: PayPageProps) {
  const params = await searchParams;
  const intentParam = params.intent;

  if (!intentParam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">No Payment Intent</h1>
          <p className="text-muted-foreground">
            Use a merchant payment link to start a payment.
          </p>
          <Link
            href="/generate-payment-link"
            className="text-primary hover:underline"
          >
            Generate a payment link →
          </Link>
        </div>
      </div>
    );
  }

  // Parse payment intent
  let paymentIntent: PaymentIntent;
  try {
    paymentIntent = JSON.parse(decodeURIComponent(intentParam));
  } catch {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">
            Invalid Payment
          </h1>
          <p className="text-muted-foreground">Could not parse payment data</p>
          <Link href="/" className="text-primary hover:underline">
            Go back home →
          </Link>
        </div>
      </div>
    );
  }

  // Fetch deposit address quote
  const quote = await getDepositQuote(paymentIntent);
  console.log(quote);

  if (!quote) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">
            Quote Unavailable
          </h1>
          <p className="text-muted-foreground">
            Could not get a quote for this payment. Please try again.
          </p>
          <Link href="/" className="text-primary hover:underline">
            Go back home →
          </Link>
        </div>
      </div>
    );
  }

  // Extract deposit address from quote
  // When useDepositAddress=true, the address is at steps[].depositAddress
  const depositStep = quote.steps?.[0];
  const depositAddress = (depositStep as { depositAddress?: string })
    ?.depositAddress;
  const requestId = depositStep?.requestId;

  console.log("Deposit address:", depositAddress);

  // Validate required quote data
  const currencyIn = quote.details?.currencyIn;
  const currencyOut = quote.details?.currencyOut;

  if (
    !depositAddress ||
    !currencyIn?.amount ||
    !currencyOut?.amount ||
    !currencyOut?.currency
  ) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">
            Quote Data Unavailable
          </h1>
          <p className="text-muted-foreground">
            Could not get complete quote data. Please try again.
          </p>
          <Link href="/" className="text-primary hover:underline">
            Go back home →
          </Link>
        </div>
      </div>
    );
  }

  // Get amounts with 15bps buffer for deposit address flow
  // (exact output not fully supported with deposit addresses)
  const BUFFER_BPS = 15; // 15 basis points = 0.15%
  const baseAmount = BigInt(currencyIn.amount);
  const bufferAmount = (baseAmount * BigInt(BUFFER_BPS)) / BigInt(10000);
  const amountToSendWithBuffer = baseAmount + bufferAmount;
  const amountToSend = amountToSendWithBuffer.toString();
  const amountToSendFormatted = formatUnits(
    amountToSendWithBuffer,
    ARBITRUM_USDC.decimals,
  );
  // USD amount also needs buffer
  const baseUsdAmount = parseFloat(currencyIn.amountUsd ?? "0");
  const usdAmountWithBuffer = baseUsdAmount * (1 + BUFFER_BPS / 10000);
  const usdAmount = usdAmountWithBuffer.toFixed(2);

  // Amount merchant receives
  const amountOut = currencyOut.amount;
  const amountOutFormatted = formatUnits(
    BigInt(amountOut),
    currencyOut.currency.decimals ?? 18,
  );
  const currencyOutSymbol = currencyOut.currency.symbol ?? "";

  // Generate EIP-681 URI
  const eip681Uri = generateEIP681Uri(depositAddress, amountToSend, usdAmount);
  console.log("EIP-681 URI:", eip681Uri);

  // Calculate total fees
  const totalFeesUsd =
    parseFloat(quote.fees?.gas?.amountUsd || "0") +
    parseFloat(quote.fees?.relayer?.amountUsd || "0") +
    parseFloat(quote.fees?.relayerGas?.amountUsd || "0") +
    parseFloat(quote.fees?.relayerService?.amountUsd || "0");

  // Ensure we have a requestId for tracking
  if (!requestId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">
            Tracking Unavailable
          </h1>
          <p className="text-muted-foreground">
            Could not get a request ID for this payment.
          </p>
          <Link href="/" className="text-primary hover:underline">
            Go back home →
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
        <div className="mt-6 mb-8 text-center">
          <h1 className="text-2xl font-bold">{paymentIntent.merchantName}</h1>
          {paymentIntent.description && (
            <p className="text-muted-foreground mt-1">
              {paymentIntent.description}
            </p>
          )}
        </div>

        {/* Amount Due */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground mb-2">Amount Due</p>
          <p className="text-5xl font-bold">
            {formatUsd(parseFloat(usdAmount).toFixed(2))}
          </p>
        </div>

        {/* Payment Status Tracker with QR Code */}
        <div className="mb-8">
          <PaymentStatusTracker
            requestId={requestId}
            eip681Uri={eip681Uri}
            merchantName={paymentIntent.merchantName}
            usdAmount={usdAmount}
            amountFormatted={amountToSendFormatted}
            tokenSymbol={ARBITRUM_USDC.symbol}
            chainName={ARBITRUM_USDC.chainName}
          />
        </div>

        {/* Payment Details Accordion */}
        <Accordion type="single" collapsible className="border rounded-lg">
          <AccordionItem value="details" className="border-none">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              Payment Details
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Deposit Address</span>
                  <AddressDisplay address={depositAddress} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <span>{ARBITRUM_USDC.chainName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer Sends</span>
                  <span>
                    {amountToSendFormatted} {ARBITRUM_USDC.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Merchant Receives
                  </span>
                  <span>
                    {amountOutFormatted} {currencyOutSymbol}
                  </span>
                </div>
                {totalFeesUsd > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fees</span>
                    <span>{formatUsd(totalFeesUsd.toString())}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">Total</span>
                  <span className="font-medium">{formatUsd(usdAmount)}</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </main>
  );
}

export default async function PayPage(props: PayPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading payment...</p>
          </div>
        </div>
      }
    >
      <PayContent {...props} />
    </Suspense>
  );
}
