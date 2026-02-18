"use client";

/**
 * Home View Component
 *
 * Displays the wallet home screen with balance and recent transactions.
 */

import { useState, useRef, useEffect } from "react";
import { QrCode, Copy, Check, LogOut, ChevronDown } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import type { Transaction } from "@/lib/wallet/types";

// Hardcoded demo spends
const DEMO_SPENDS = [
  {
    id: "1",
    merchant: "Demo Coffee Shop",
    date: "12 Dec, 2025",
    amount: "$5",
    image: "/images/demo-blend.png",
  },
  {
    id: "2",
    merchant: "Gourmet Tea House",
    date: "15 Dec, 2025",
    amount: "$7",
    image: "/images/gourmet-tea-house.jpg",
  },
  {
    id: "3",
    merchant: "Artisan Bakery",
    date: "20 Dec, 2025",
    amount: "$8",
    image: "/images/artisan-bakery.jpg",
  },
];

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
  balanceUsd,
  isLoadingBalance,
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
          {/* ENS + avatar with dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                R
              </div>
              <span className="font-semibold text-sm">Rrrrl.eth</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>

            {showMenu && (
              <div className="absolute top-full left-0 mt-2 z-10 bg-background border border-border rounded-lg shadow-lg min-w-[200px] py-1">
                <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                  {truncateAddress(address, 6, 4)}
                </div>
                <button
                  onClick={() => {
                    onCopyAddress();
                    setShowMenu(false);
                  }}
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
                  onClick={() => {
                    onDisconnect();
                    setShowMenu(false);
                  }}
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
            aria-label="Scan QR code"
          >
            <QrCode className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Balance */}
      <div className="px-4 pt-8 pb-4">
        <div className="max-w-md mx-auto">
          <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
          {isLoadingBalance ? (
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
          ) : (
            <p className="text-4xl font-bold">${balanceUsd.toFixed(2)}</p>
          )}
        </div>
      </div>

      {/* Card image — full width */}
      <div className="px-4 pb-8">
        <div className="max-w-md mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/RelayCC.png"
            alt="Relay Card"
            className="w-full h-auto rounded-2xl"
          />
        </div>
      </div>

      {/* Spends Section */}
      <div className="px-4">
        <div className="max-w-md mx-auto">
          <h2 className="font-semibold mb-3">Spends</h2>
          <div className="rounded-2xl bg-muted/40 border divide-y">
            {DEMO_SPENDS.map((spend) => (
              <div
                key={spend.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Merchant avatar */}
                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={spend.image}
                    alt={spend.merchant}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Merchant info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{spend.merchant}</p>
                  <p className="text-xs text-muted-foreground">{spend.date}</p>
                </div>

                {/* Amount */}
                <p className="font-semibold text-sm">
                  -{spend.amount}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default HomeView;
