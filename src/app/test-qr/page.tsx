"use client";

import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const TEST_URI = "ethereum:0x03508bB71268BBA25ECaCC8F620e01866650532c?usdAmount=0.1";

export default function TestQRPage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-md mx-auto">
        <Link
          href="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Test Payment QR</h1>
          <p className="text-sm text-muted-foreground">
            Scan this with the wallet to test
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-lg">
            <QRCodeSVG value={TEST_URI} size={280} level="M" />
          </div>

          <div className="text-center">
            <p className="text-2xl font-bold">$0.10 USD</p>
            <p className="text-sm text-muted-foreground mt-1">
              ~ETH at current rate
            </p>
          </div>

          <div className="w-full bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Payment URI</p>
            <code className="text-xs font-mono break-all">{TEST_URI}</code>
          </div>

          <Link
            href="/wallet"
            className="w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-lg text-center hover:bg-primary/90 transition-colors"
          >
            Open Scanner
          </Link>
        </div>
      </div>
    </main>
  );
}
