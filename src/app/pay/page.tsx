import { Suspense } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { AddressDisplay } from "@/components/common";
import { PaymentStatusTracker } from "@/components/pay";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Payment intent structure (from payment link)
interface PaymentIntent {
  destinationChainId: number;
  destinationCurrency: string;
  amount: string;
  recipient: string;
  merchantName: string;
  description?: string;
  currencySymbol?: string;
  currencyDecimals?: number;
  chainName?: string;
}

// Generate EIP-681 URI for QR code
// Encodes a direct transfer of the destination token on the destination chain
function generateEIP681Uri(
  tokenAddress: string,
  chainId: number,
  recipient: string,
  amount: string,
  usdAmount: string,
  merchantName?: string,
  description?: string,
): string {
  const params = new URLSearchParams();
  params.set("address", recipient);
  params.set("uint256", amount);
  params.set("usdAmount", usdAmount);
  if (merchantName) params.set("merchantName", merchantName);
  if (description) params.set("description", description);

  return `ethereum:${tokenAddress}@${chainId}/transfer?${params.toString()}`;
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

  // Resolve display metadata (with fallbacks for old-format intents)
  const tokenSymbol = paymentIntent.currencySymbol ?? "USDC";
  const tokenDecimals = paymentIntent.currencyDecimals ?? 6;
  const chainName =
    paymentIntent.chainName ??
    `Chain ${paymentIntent.destinationChainId}`;

  // For same-chain same-token payments, we generate a direct transfer EIP-681 URI
  // to the merchant's address. No Relay quote or deposit address needed.
  // The wallet flow handles cross-chain logic + 15bps when the user picks a different currency.
  const amountFormatted = formatUnits(BigInt(paymentIntent.amount), tokenDecimals);

  // Approximate USD amount (for stablecoins, 1:1 with face value)
  const usdAmount = amountFormatted;

  // Generate EIP-681 URI — direct transfer to merchant on the destination chain
  const eip681Uri = generateEIP681Uri(
    paymentIntent.destinationCurrency,
    paymentIntent.destinationChainId,
    paymentIntent.recipient,
    paymentIntent.amount,
    usdAmount,
    paymentIntent.merchantName,
    paymentIntent.description,
  );

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
            {formatUsd(usdAmount)}
          </p>
        </div>

        {/* Payment Status Tracker with QR Code */}
        <div className="mb-8">
          <PaymentStatusTracker
            depositAddress={null}
            eip681Uri={eip681Uri}
            merchantName={paymentIntent.merchantName}
            usdAmount={usdAmount}
            amountFormatted={amountFormatted}
            tokenSymbol={tokenSymbol}
            chainName={chainName}
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
                  <span className="text-muted-foreground">Pay To</span>
                  <AddressDisplay address={paymentIntent.recipient} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <span>{chainName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span>
                    {amountFormatted} {tokenSymbol}
                  </span>
                </div>
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
