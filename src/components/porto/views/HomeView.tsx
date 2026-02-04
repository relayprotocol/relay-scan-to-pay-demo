"use client";

/**
 * Home View Component
 *
 * Displays the wallet home screen with balance and recent transactions.
 */

import { QrCode, Copy, Check } from "lucide-react";
import { truncateAddress, formatUsd } from "@/lib/utils";
import { ARBITRUM_USDC } from "@/lib/porto/constants";
import type { Transaction } from "@/lib/porto/types";

interface HomeViewProps {
  address: `0x${string}`;
  balance: string;
  balanceUsd: number;
  isLoadingBalance: boolean;
  transactions: Transaction[];
  copied: boolean;
  onCopyAddress: () => void;
  onOpenScanner: () => void;
  onDisconnect: () => void;
}

export function HomeView({
  address,
  balance,
  balanceUsd,
  isLoadingBalance,
  transactions,
  copied,
  onCopyAddress,
  onOpenScanner,
  onDisconnect,
}: HomeViewProps) {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* Avatar + Address */}
          <button
            onClick={onCopyAddress}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
            <div className="flex items-center gap-1">
              <span className="font-mono text-sm">
                {truncateAddress(address, 4, 4)}
              </span>
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          </button>

          {/* Scan Button */}
          <button
            onClick={onOpenScanner}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <QrCode className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Balance */}
      <div className="px-4 py-8">
        <div className="max-w-md mx-auto">
          <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
          {isLoadingBalance ? (
            <div className="h-12 w-32 bg-muted animate-pulse rounded" />
          ) : (
            <p className="text-4xl font-bold">
              {formatUsd(balanceUsd.toString())}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {balance} {ARBITRUM_USDC.symbol} on Arbitrum
          </p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="px-4">
        <div className="max-w-md mx-auto">
          <h2 className="font-semibold mb-4">Spends</h2>

          {transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No recent transactions</p>
              <p className="text-xs mt-1">
                Scan a payment QR code to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {tx.merchant.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{tx.merchant}</p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                  <p className="font-medium text-right">-${tx.amountUsd}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={onDisconnect}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Disconnect
          </button>
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <a
              href="https://porto.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Porto
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}

export default HomeView;
