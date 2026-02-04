"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchIntentStatus,
  type IntentStatusResponse,
  type IntentStatusValue,
} from "@/lib/relay";

interface UseIntentStatusOptions {
  /** Polling interval in milliseconds (default: 3000) */
  pollingInterval?: number;
  /** Whether to enable polling (default: true) */
  enabled?: boolean;
  /** Stop polling when status reaches a terminal state */
  stopOnTerminal?: boolean;
}

const TERMINAL_STATUSES: IntentStatusValue[] = [
  "success",
  "failure",
  "refund",
  "refunded",
];

/**
 * Hook to poll Relay intent status
 *
 * @param requestId - The Relay request ID to track
 * @param options - Polling configuration
 * @returns Query result with status data
 *
 * @example
 * const { data, isLoading } = useIntentStatus(requestId, {
 *   pollingInterval: 2000,
 *   stopOnTerminal: true,
 * });
 */
export function useIntentStatus(
  requestId: string | null | undefined,
  options: UseIntentStatusOptions = {}
) {
  const {
    pollingInterval = 3000,
    enabled = true,
    stopOnTerminal = true,
  } = options;

  return useQuery<IntentStatusResponse>({
    queryKey: ["relay", "intent-status", requestId],
    queryFn: () => fetchIntentStatus(requestId!),
    enabled: enabled && !!requestId,
    refetchInterval: (query) => {
      // Stop polling if we've reached a terminal status
      if (stopOnTerminal && query.state.data?.status) {
        if (TERMINAL_STATUSES.includes(query.state.data.status)) {
          return false;
        }
      }
      return pollingInterval;
    },
    staleTime: 0, // Always consider data stale for polling
    retry: 2,
  });
}

/**
 * Check if a status is terminal (no more updates expected)
 */
export function isTerminalStatus(status: IntentStatusValue): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Check if a status indicates success
 */
export function isSuccessStatus(status: IntentStatusValue): boolean {
  return status === "success";
}

/**
 * Check if a status indicates failure or refund
 */
export function isFailureStatus(status: IntentStatusValue): boolean {
  return status === "failure" || status === "refund" || status === "refunded";
}

/**
 * Get a human-readable description for a status
 */
export function getStatusDescription(status: IntentStatusValue): string {
  switch (status) {
    case "waiting":
      return "Waiting for payment...";
    case "pending":
      return "Payment received, processing...";
    case "submitted":
      return "Transaction submitted...";
    case "success":
      return "Payment complete!";
    case "delayed":
      return "Processing (may take longer)...";
    case "refund":
      return "Processing refund...";
    case "refunded":
      return "Payment refunded";
    case "failure":
      return "Payment failed";
    default:
      return "Unknown status";
  }
}
