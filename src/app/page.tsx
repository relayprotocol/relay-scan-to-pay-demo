"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RelayLogo } from "@/components/icons/RelayLogo";

// Pre-generated demo payment intent
const demoPaymentIntent = {
  destinationChainId: 8453, // Base
  destinationCurrency: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  amount: "1000000", // 1 USDC (6 decimals)
  recipient: "0x03508bB71268BBA25ECaCC8F620e01866650532c",
  merchantName: "Demo Coffee Shop",
  description: "Coffee + Pastry",
};

export default function Home() {
  const demoPayUrl = useMemo(() => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/pay?intent=${encodeURIComponent(JSON.stringify(demoPaymentIntent))}`;
  }, []);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <RelayLogo width={100} height={28} />
          <a
            href="https://relay.link"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            relay.link
          </a>
        </div>

        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Scan-to-Pay Demo</h1>
          <p className="text-lg text-muted-foreground mb-6">
            A demonstration of crypto payments for physical checkout flows using{" "}
            <a
              href="https://relay.link"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Relay
            </a>{" "}
            and{" "}
            <a
              href="https://porto.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Porto
            </a>
            . Merchants generate payment links, customers scan QR codes, and pay
            seamlessly with their Porto wallet.
          </p>
        </div>

        {/* How it works */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 border rounded-lg bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold mb-3">
                1
              </div>
              <h3 className="font-medium mb-1">Merchant generates link</h3>
              <p className="text-sm text-muted-foreground">
                Create a payment link specifying the amount and recipient
                address for USDC.
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold mb-3">
                2
              </div>
              <h3 className="font-medium mb-1">Link generates QR code</h3>
              <p className="text-sm text-muted-foreground">
                The checkout page displays a deposit address and QR code for the
                transaction.
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold mb-3">
                3
              </div>
              <h3 className="font-medium mb-1">Customer pays with Porto</h3>
              <p className="text-sm text-muted-foreground">
                Customer scans the QR code with their Porto wallet and completes
                the payment.
              </p>
            </div>
          </div>
        </div>

        {/* Demo Section */}
        <div className="grid gap-8 md:grid-cols-2 mb-12">
          {/* Generate Payment Link */}
          <div className="p-6 border rounded-xl bg-card">
            <h3 className="font-semibold text-lg mb-2">Merchant View</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate a payment link as a merchant. Share it with customers to
              receive payments.
            </p>
            <Link
              href="/generate-payment-link"
              className="inline-flex items-center justify-center w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Generate Payment Link
            </Link>
          </div>

          {/* Demo Payment Link */}
          <div className="p-6 border rounded-xl bg-card">
            <h3 className="font-semibold text-lg mb-2">Try the Demo</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Open a demo payment link to see the customer payment experience.
            </p>
            <div className="text-sm text-muted-foreground mb-4">
              <p className="font-medium text-foreground">Demo Coffee Shop</p>
              <p>1 USDC on Base</p>
            </div>
            <Link
              href={demoPayUrl}
              className="inline-flex items-center justify-center w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Open Payment Link
            </Link>
          </div>
        </div>

        {/* Porto Wallet Section */}
        <div className="mb-12 p-6 border rounded-xl bg-gradient-to-br from-primary/5 to-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg">Porto Wallet</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Porto Wallet is used for demo purposes to showcase the QR
            scan-to-pay feature and how wallets can interact with Relay.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2 py-1 text-xs bg-muted rounded-md">
              EIP-681 Support
            </span>
            <span className="px-2 py-1 text-xs bg-muted rounded-md">
              USDC Payments
            </span>
            <span className="px-2 py-1 text-xs bg-muted rounded-md">
              Multi-chain
            </span>
          </div>
          <Link
            href="/porto-wallet"
            className="inline-flex items-center justify-center w-full sm:w-auto py-3 px-6 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Open Wallet
          </Link>
        </div>

        {/* Powered by Relay */}
        <div className="text-center py-8 border-t">
          <p className="text-sm text-muted-foreground mb-3">Powered by</p>
          <a
            href="https://relay.link"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors"
          >
            <RelayLogo width={80} height={22} />
          </a>

          <div className="flex items-center justify-center gap-4 mt-4">
            <a
              href="https://docs.relay.link"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Documentation
            </a>
            <span className="text-muted-foreground/30">|</span>
            <a
              href="https://github.com/relayprotocol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
