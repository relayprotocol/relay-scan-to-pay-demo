"use client";

/**
 * Connect View Component
 *
 * Displays the wallet connection prompt when user is not connected.
 */

import Link from "next/link";
import { Wallet, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConnectViewProps {
  onConnect: () => void;
  isConnecting: boolean;
  wrongWallet?: boolean;
  onDisconnect?: () => void;
}

export function ConnectView({
  onConnect,
  isConnecting,
  wrongWallet = false,
  onDisconnect,
}: ConnectViewProps) {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Wallet className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">Porto Wallet</h1>
          <p className="text-muted-foreground">
            Connect your Porto wallet to get started
          </p>
        </div>

        {/* Wrong wallet warning */}
        {wrongWallet && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                  Wrong wallet connected
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  This page requires Porto wallet. Please disconnect and connect with Porto.
                </p>
              </div>
            </div>
          </div>
        )}

        {wrongWallet && onDisconnect ? (
          <div className="space-y-3">
            <Button
              onClick={onDisconnect}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Disconnect Current Wallet
            </Button>
            <Button
              onClick={onConnect}
              disabled={isConnecting}
              className="w-full"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Porto"
              )}
            </Button>
          </div>
        ) : (
          <Button
            onClick={onConnect}
            disabled={isConnecting}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect Wallet"
            )}
          </Button>
        )}

        <Link
          href="/"
          className="block text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to home
        </Link>
      </div>
    </main>
  );
}

export default ConnectView;
