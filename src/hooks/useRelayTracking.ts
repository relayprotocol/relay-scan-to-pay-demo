"use client";

import { useQuery } from "@tanstack/react-query";
import { MAINNET_RELAY_API } from "@/lib/relay";

export interface RelayRequest {
  id?: string;
  status?: "refund" | "waiting" | "failure" | "pending" | "success";
  user?: string;
  recipient?: string;
}

interface RelayRequestsResponse {
  requests?: RelayRequest[];
}

/**
 * Fetch the most recent Relay request for a deposit address.
 * Queries /requests/v2?user=<depositAddress> sorted by most recent.
 */
async function fetchRequestByDepositAddress(
  depositAddress: string,
): Promise<RelayRequest | null> {
  const params = new URLSearchParams({
    user: depositAddress,
    sortBy: "createdAt",
    sortDirection: "desc",
    limit: "1",
  });

  const response = await fetch(
    `${MAINNET_RELAY_API}/requests/v2?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch request: ${response.status}`);
  }

  const data: RelayRequestsResponse = await response.json();
  return data.requests?.[0] ?? null;
}

interface UseRelayTrackingOptions {
  pollingInterval?: number;
  enabled?: boolean;
}

const TERMINAL_STATUSES = ["success", "failure", "refund"];

/**
 * Hook to track a Relay payment by deposit address.
 *
 * Polls /requests/v2?user=<depositAddress> until a terminal status is reached.
 * Used by both the wallet (after sending to deposit address) and the payment
 * link page (while waiting for customer payment).
 */
export function useRelayTracking(
  depositAddress: string | null,
  options: UseRelayTrackingOptions = {},
) {
  const { pollingInterval = 3000, enabled = true } = options;

  return useQuery<RelayRequest | null>({
    queryKey: ["relay", "request-by-deposit", depositAddress],
    queryFn: () => fetchRequestByDepositAddress(depositAddress!),
    enabled: enabled && !!depositAddress,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) {
        return false;
      }
      return pollingInterval;
    },
    staleTime: 0,
    retry: 2,
  });
}
