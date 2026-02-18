import Link from "next/link";
import { RelayLogo } from "@/components/icons/RelayLogo";

// Pre-generated demo payment intent
const demoPaymentIntent = {
  destinationChainId: 8453, // Base
  destinationCurrency: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  amount: "1000000", // 1 USDC (6 decimals)
  recipient: "0x03508bB71268BBA25ECaCC8F620e01866650532c",
  merchantName: "Demo Coffee Shop",
  description: "Coffee + Pastry",
  currencySymbol: "USDC",
  currencyDecimals: 6,
  chainName: "Base",
};

export default function Home() {
  const demoPayUrl = `/pay?intent=${encodeURIComponent(JSON.stringify(demoPaymentIntent))}`;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <RelayLogo width={100} height={24} />
          <span className="text-xs text-muted-foreground">
            Scan-to-Pay Demo
          </span>
        </div>
      </header>

      {/* Intro */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-muted-foreground">
          Prototype for payments at checkout — powered by{" "}
          <a
            href="https://relay.link"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            Relay
          </a>
          .
        </p>
      </section>

      {/* How It Works */}
      <section className="border-t bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-3xl font-semibold">
            How It Works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg">
                1
              </div>
              <h3 className="mb-2 font-medium text-lg">
                Merchant creates a payment link
              </h3>
              <p className="text-sm text-muted-foreground">
                Specify the amount, destination chain, and recipient address for
                stablecoin payment.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg">
                2
              </div>
              <h3 className="mb-2 font-medium text-lg">
                Link generates a QR code
              </h3>
              <p className="text-sm text-muted-foreground">
                The checkout page displays a QR code for the customer to scan.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg">
                3
              </div>
              <h3 className="mb-2 font-medium text-lg">
                Customer scans and pays
              </h3>
              <p className="text-sm text-muted-foreground">
                Customer scans the QR code with their wallet and pays with
                stablecoins. Relay handles the rest.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Two Demo Flow Cards */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1: Payment Links */}
          <div className="group relative rounded-2xl border bg-card p-8 transition-shadow hover:shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <svg
                className="h-6 w-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-semibold">Payment Links</h2>
            <p className="mb-5 text-muted-foreground">
              Merchant generates a link, customer pays from any wallet — no
              wallet connection needed.
            </p>
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                No wallet connection
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                Any external wallet
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                QR code or link
              </span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/generate-payment-link"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Generate Payment Link
              </Link>
              <Link
                href={demoPayUrl}
                className="inline-flex items-center justify-center rounded-lg border px-5 py-3 font-medium transition-colors hover:bg-muted"
              >
                Try Demo
              </Link>
            </div>
          </div>

          {/* Card 2: Scan to Pay (Embedded Wallet) */}
          <div className="group relative rounded-2xl border bg-card p-8 transition-shadow hover:shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <svg
                className="h-6 w-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5Z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-semibold">Scan to Pay</h2>
            <p className="mb-5 text-muted-foreground">
              Built-in wallet with QR scanner. Connect once, scan and pay —
              powered by Privy embedded wallets + Relay.
            </p>
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                Embedded wallet
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                QR scanner
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                Multi-chain
              </span>
            </div>
            <Link
              href="/wallet"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open Wallet
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
