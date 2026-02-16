"use client";

import { useState, useEffect, useRef } from "react";
import { useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { type Log } from "viem";

export type TransferStatus = "waiting" | "success";

interface TransferTrackingResult {
  status: TransferStatus;
  txHash: string | null;
  error: Error | null;
}

interface UseTransferTrackingOptions {
  /** Recipient address to watch for incoming transfers */
  recipientAddress: string | null;
  /** ERC-20 token contract address */
  tokenAddress: string | null;
  /** Chain ID to poll */
  chainId: number | null;
  /** Minimum amount the merchant expects (in token's smallest unit) */
  expectedAmount: string | null;
  /** Polling interval in ms (default: 3000) */
  pollingInterval?: number;
  /** Whether tracking is enabled */
  enabled?: boolean;
  /** Whether this is a native ETH transfer (uses balance-diff polling) */
  isNative?: boolean;
}

/**
 * Hook to track incoming transfers to a recipient address.
 *
 * For ERC-20 tokens: Polls eth_getLogs for Transfer events.
 * For native ETH: Polls getBalance and detects balance increase >= expectedAmount.
 */
export function useTransferTracking({
  recipientAddress,
  tokenAddress,
  chainId,
  expectedAmount,
  pollingInterval = 3000,
  enabled = true,
  isNative = false,
}: UseTransferTrackingOptions): TransferTrackingResult {
  const config = useConfig();
  const [status, setStatus] = useState<TransferStatus>("waiting");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Use state for startBlock so the polling effect re-triggers when it's set
  const [startBlock, setStartBlock] = useState<bigint | null>(null);
  // Starting balance for native ETH tracking
  const [startBalance, setStartBalance] = useState<bigint | null>(null);
  // Prevent duplicate polls
  const pollingRef = useRef(false);

  const isActiveERC20 =
    enabled &&
    !isNative &&
    !!recipientAddress &&
    !!tokenAddress &&
    !!chainId &&
    !!expectedAmount &&
    status !== "success";

  const isActiveNative =
    enabled &&
    isNative &&
    !!recipientAddress &&
    !!chainId &&
    !!expectedAmount &&
    status !== "success";

  // Capture starting block (ERC-20) or starting balance (native) on mount
  useEffect(() => {
    if (!isActiveERC20 && !isActiveNative) return;

    const client = getPublicClient(config, { chainId: chainId! });
    if (!client) return;

    let cancelled = false;

    if (isActiveNative) {
      // Capture starting balance for native tracking
      client
        .getBalance({ address: recipientAddress as `0x${string}` })
        .then((balance) => {
          if (!cancelled) setStartBalance(balance);
        });
    } else {
      // Capture starting block for ERC-20 tracking
      client.getBlockNumber().then((blockNumber) => {
        if (!cancelled) {
          setStartBlock(blockNumber > BigInt(5) ? blockNumber - BigInt(5) : BigInt(0));
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [config, chainId, isActiveERC20, isActiveNative, recipientAddress]);

  // Poll for ERC-20 Transfer events
  useEffect(() => {
    if (!isActiveERC20 || startBlock === null) return;

    const interval = setInterval(async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;

      try {
        const client = getPublicClient(config, { chainId: chainId! });
        if (!client) return;

        // Pad recipient address to 32 bytes for topic filter
        const paddedRecipient = `0x${recipientAddress!.slice(2).padStart(64, "0")}` as `0x${string}`;

        const logs: Log[] = await client.request({
          method: "eth_getLogs",
          params: [
            {
              address: tokenAddress as `0x${string}`,
              topics: [
                // Transfer event signature
                "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
                // from: any
                null,
                // to: recipient address
                paddedRecipient,
              ],
              fromBlock: `0x${startBlock.toString(16)}`,
              toBlock: "latest",
            },
          ],
        });

        if (logs.length > 0) {
          const requiredAmount = BigInt(expectedAmount!);

          // Check each log for sufficient amount
          for (const log of logs) {
            // The value is in the data field (non-indexed uint256)
            const transferValue = BigInt(log.data);
            if (transferValue >= requiredAmount) {
              setTxHash(log.transactionHash);
              setStatus("success");
              break;
            }
          }
        }
      } catch (err) {
        console.error("Transfer tracking error:", err);
        setError(err instanceof Error ? err : new Error("Tracking failed"));
      } finally {
        pollingRef.current = false;
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [
    isActiveERC20,
    startBlock,
    config,
    chainId,
    recipientAddress,
    tokenAddress,
    expectedAmount,
    pollingInterval,
  ]);

  // Poll native ETH balance for balance-diff detection
  useEffect(() => {
    if (!isActiveNative || startBalance === null) return;

    const interval = setInterval(async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;

      try {
        const client = getPublicClient(config, { chainId: chainId! });
        if (!client) return;

        const currentBalance = await client.getBalance({
          address: recipientAddress as `0x${string}`,
        });

        const requiredAmount = BigInt(expectedAmount!);
        if (currentBalance >= startBalance + requiredAmount) {
          // No txHash available for balance-based tracking
          setTxHash(null);
          setStatus("success");
        }
      } catch (err) {
        console.error("Native transfer tracking error:", err);
        setError(err instanceof Error ? err : new Error("Tracking failed"));
      } finally {
        pollingRef.current = false;
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [
    isActiveNative,
    startBalance,
    config,
    chainId,
    recipientAddress,
    expectedAmount,
    pollingInterval,
  ]);

  return { status, txHash, error };
}
