"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { formatUnits } from "viem"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { useRelayChains } from "@/providers"
import { useRelayCurrencies } from "@/hooks/useRelayCurrencies"
import { AddressDisplay } from "@/components/CopyButton"
import { truncateAddress } from "@/lib/utils"

// Payment intent structure (from QR code)
interface PaymentIntent {
  destinationChainId: number
  destinationCurrency: string
  amount: string
  recipient: string
  merchantId: string
  merchantName: string
  orderId: string
  description?: string
  tradeType: "EXACT_OUTPUT"
  createdAt: string
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const intentParam = searchParams.get("intent")
  const { chains } = useRelayChains()

  // Privy hooks
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { wallets } = useWallets()

  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "quoting" | "processing" | "success" | "error"
  >("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Parse payment intent from URL
  let paymentIntent: PaymentIntent | null = null
  let parseError: string | null = null

  if (intentParam) {
    try {
      paymentIntent = JSON.parse(decodeURIComponent(intentParam))
    } catch {
      parseError = "Invalid payment intent"
    }
  }

  // Fetch currency info from Relay API
  const { data: currencies = [] } = useRelayCurrencies(
    {
      chainIds: paymentIntent ? [paymentIntent.destinationChainId] : [],
      address: paymentIntent?.destinationCurrency,
      limit: 1,
    },
    !!paymentIntent?.destinationCurrency
  )

  const currency = currencies[0]

  // Get chain info for display
  const destinationChain = useMemo(() => {
    if (!paymentIntent) return null
    return chains.find((c) => c.id === paymentIntent.destinationChainId)
  }, [chains, paymentIntent])

  // Format amount for display using viem
  const formattedAmount = useMemo(() => {
    if (!paymentIntent) return "0"
    const decimals = currency?.decimals || 18
    return formatUnits(BigInt(paymentIntent.amount), decimals)
  }, [paymentIntent, currency])

  const currencySymbol = currency?.symbol || "???"

  // Get primary wallet
  const primaryWallet = wallets[0]
  const walletAddress = primaryWallet?.address

  const handlePay = async () => {
    if (!paymentIntent || !primaryWallet) return

    setPaymentStatus("quoting")
    setErrorMessage(null)

    try {
      // TODO: Implement Relay quote + execution flow
      // 1. Get user's wallet address
      // 2. Determine user's origin chain and currency
      // 3. Call Relay quote API
      // 4. Execute the quote using Relay SDK

      await new Promise((resolve) => setTimeout(resolve, 1000))
      setPaymentStatus("processing")
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setPaymentStatus("success")
    } catch (err) {
      setPaymentStatus("error")
      setErrorMessage(err instanceof Error ? err.message : "Payment failed")
    }
  }

  // No intent provided
  if (!intentParam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">No Payment Intent</h1>
          <p className="text-muted-foreground">
            Scan a merchant QR code to start a payment.
          </p>
          <Link href="/generate-qr-code" className="text-primary hover:underline">
            Generate a test QR code →
          </Link>
        </div>
      </div>
    )
  }

  // Parse error
  if (parseError || !paymentIntent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Invalid Payment</h1>
          <p className="text-muted-foreground">
            {parseError || "Could not parse payment data"}
          </p>
          <Link href="/" className="text-primary hover:underline">
            Go back home →
          </Link>
        </div>
      </div>
    )
  }

  // Payment success
  if (paymentStatus === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-3xl text-green-600">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-green-600">Payment Complete!</h1>
          <p className="text-muted-foreground">
            Your payment of {formattedAmount} {currencySymbol} to{" "}
            {paymentIntent.merchantName} was successful.
          </p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Order ID: {paymentIntent.orderId}</p>
            <p className="flex items-center justify-center gap-1">
              Recipient: <AddressDisplay address={paymentIntent.recipient} />
            </p>
          </div>
          <Link href="/" className="inline-block mt-4 text-primary hover:underline">
            Done
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
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
            {currency?.metadata?.logoURI && (
              <Image
                src={currency.metadata.logoURI}
                alt={currencySymbol}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <p className="text-4xl font-bold">
              {formattedAmount} {currencySymbol}
            </p>
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
            {destinationChain?.displayName || destinationChain?.name || `Chain ${paymentIntent.destinationChainId}`}
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
                {destinationChain?.displayName || destinationChain?.name || paymentIntent.destinationChainId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Currency</span>
              <span>{currencySymbol}</span>
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
                      <AddressDisplay address={walletAddress} className="text-sm" />
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
                <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm">
                    $
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">$CASH by Phantom</p>
                    <p className="text-xs text-muted-foreground">Default payment asset</p>
                  </div>
                  <span className="text-xs text-muted-foreground">Change →</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Powered by Relay - pay with any asset
                </p>
              </div>

              <button
                onClick={handlePay}
                disabled={paymentStatus === "quoting" || paymentStatus === "processing"}
                className="w-full py-4 px-6 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {paymentStatus === "quoting" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span>
                    Getting quote...
                  </span>
                ) : paymentStatus === "processing" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span>
                    Processing payment...
                  </span>
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
      </div>
    </main>
  )
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
  )
}
