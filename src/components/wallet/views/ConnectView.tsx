"use client";

/**
 * Connect View Component
 *
 * Displays the sign-in prompt when user is not authenticated.
 */

import Link from "next/link";
import { Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConnectViewProps {
  onConnect: () => void;
  isConnecting: boolean;
}

export function ConnectView({
  onConnect,
  isConnecting,
}: ConnectViewProps) {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Wallet className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">Wallet</h1>
          <p className="text-muted-foreground">
            Sign in to get started
          </p>
        </div>

        <Button
          onClick={onConnect}
          disabled={isConnecting}
          className="w-full"
          size="lg"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>

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
