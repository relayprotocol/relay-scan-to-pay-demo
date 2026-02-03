import { Suspense } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { formatUnits } from "viem";
import { AddressDisplay } from "@/components/common";
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
  const depositStep = quote.steps?.[0];
  const depositAddress = (depositStep?.items?.[0]?.data as { to?: string })?.to;
  const requestId = depositStep?.requestId;

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

  // Get amounts
  const amountToSend = currencyIn.amount;
  const amountToSendFormatted = formatUnits(
    BigInt(amountToSend),
    ARBITRUM_USDC.decimals,
  );
  const usdAmount = currencyIn.amountUsd ?? "0";

  // Amount merchant receives
  const amountOut = currencyOut.amount;
  const amountOutFormatted = formatUnits(
    BigInt(amountOut),
    currencyOut.currency.decimals ?? 18,
  );
  const currencyOutSymbol = currencyOut.currency.symbol ?? "";

  // Generate EIP-681 URI
  const eip681Uri = generateEIP681Uri(depositAddress, amountToSend, usdAmount);

  // Calculate total fees
  const totalFeesUsd =
    parseFloat(quote.fees?.gas?.amountUsd || "0") +
    parseFloat(quote.fees?.relayer?.amountUsd || "0") +
    parseFloat(quote.fees?.relayerGas?.amountUsd || "0") +
    parseFloat(quote.fees?.relayerService?.amountUsd || "0");

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
            {formatUsd(currencyOut.amountUsd)}
          </p>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <QRCodeSVG value={eip681Uri} size={200} level="M" />
          </div>
          <p className="text-sm font-medium mt-4">Scan with wallet</p>
          <p className="text-xs text-muted-foreground mt-2">
            Send {amountToSendFormatted} {ARBITRUM_USDC.symbol} on{" "}
            {ARBITRUM_USDC.chainName}
          </p>
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
                  <span className="text-muted-foreground">You Send</span>
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

        {/* Track Payment Link */}
        {requestId && (
          <div className="text-center mt-6">
            <a
              href={`https://relay.link/transaction/${requestId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary"
            >
              Track payment status →
            </a>
          </div>
        )}
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
