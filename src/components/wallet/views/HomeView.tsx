"use client";

/**
 * Home View Component
 *
 * Displays the wallet home screen with balance and recent transactions.
 */

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { QrCode, Copy, Check, LogOut } from "lucide-react";
import { truncateAddress, formatUsd } from "@/lib/utils";
import type { Transaction } from "@/lib/wallet/types";

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
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* Avatar + Address with dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
              <span className="font-mono text-sm">
                {truncateAddress(address, 4, 4)}
              </span>
            </button>

            {showMenu && (
              <div className="absolute top-full left-0 mt-2 z-10 bg-background border border-border rounded-lg shadow-lg min-w-[180px] py-1">
                <button
                  onClick={() => { onCopyAddress(); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                  {copied ? "Copied!" : "Copy Address"}
                </button>
                <button
                  onClick={() => { onDisconnect(); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2 text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            )}
          </div>

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
        <div className="max-w-md mx-auto flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
            {isLoadingBalance ? (
              <div className="h-12 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <p className="text-4xl font-bold">
                {formatUsd(balanceUsd.toString())}
              </p>
            )}
          </div>
          <Image
            src="/RelayCC.png"
            alt="Relay"
            width={80}
            height={45}
            className="w-20 h-auto"
            priority
          />
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

    </main>
  );
}

export default HomeView;
