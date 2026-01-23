"use client"

import Link from "next/link"
import { useMemo } from "react"
import { QRCodeSVG } from "qrcode.react"
import { RelayLogo } from "@/components/icons/RelayLogo"

// Pre-generated demo payment intent
const demoPaymentIntent = {
  destinationChainId: 8453, // Base
  destinationCurrency: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  amount: "5000000", // 5 USDC (6 decimals)
  recipient: "0x03508bB71268BBA25ECaCC8F620e01866650532c",
  merchantId: "demo_merchant",
  merchantName: "Demo Coffee Shop",
  orderId: "DEMO-001",
  description: "Coffee + Pastry",
  tradeType: "EXACT_OUTPUT" as const,
  createdAt: new Date().toISOString(),
}

export default function Home() {
  const demoCheckoutUrl = useMemo(() => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    return `${baseUrl}/checkout?intent=${encodeURIComponent(JSON.stringify(demoPaymentIntent))}`
  }, [])

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
            </a>
            . Merchants generate QR codes specifying their desired payment token, and customers can
            pay with any asset from any chain.
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
              <h3 className="font-medium mb-1">Merchant generates QR</h3>
              <p className="text-sm text-muted-foreground">
                Specify the token, amount, and recipient address for the payment.
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold mb-3">
                2
              </div>
              <h3 className="font-medium mb-1">Customer scans</h3>
              <p className="text-sm text-muted-foreground">
                Customer scans the QR code and connects their wallet.
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold mb-3">
                3
              </div>
              <h3 className="font-medium mb-1">Pay with any asset</h3>
              <p className="text-sm text-muted-foreground">
                Relay handles cross-chain swaps so customers pay with any token.
              </p>
            </div>
          </div>
        </div>

        {/* Demo Section */}
        <div className="grid gap-8 md:grid-cols-2 mb-12">
          {/* Generate QR */}
          <div className="p-6 border rounded-xl bg-card">
            <h3 className="font-semibold text-lg mb-2">Merchant View</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate a payment QR code as if you were a merchant.
            </p>
            <Link
              href="/generate-qr-code"
              className="inline-flex items-center justify-center w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Generate QR Code
            </Link>
          </div>

          {/* Demo QR */}
          <div className="p-6 border rounded-xl bg-card">
            <h3 className="font-semibold text-lg mb-2">Try the Demo</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Scan this QR or click below to try the customer checkout flow.
            </p>
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-3 rounded-lg">
                <QRCodeSVG value={demoCheckoutUrl} size={140} level="M" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">5 USDC on Base</p>
                <p className="text-xs text-muted-foreground">Demo Coffee Shop</p>
              </div>
              <Link
                href={`/checkout?intent=${encodeURIComponent(JSON.stringify(demoPaymentIntent))}`}
                className="inline-flex items-center justify-center w-full py-3 px-4 border border-input font-medium rounded-lg hover:bg-muted transition-colors"
              >
                Open Checkout
              </Link>
            </div>
          </div>
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
          <p className="text-xs text-muted-foreground mt-3">
            Cross-chain token transfers and swaps
          </p>
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
  )
}
