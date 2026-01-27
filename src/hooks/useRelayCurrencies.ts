"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchCurrencies, type CurrenciesV2RequestBody, type Currency } from "@/lib/relay"

const REFERRER = "relay-scan-to-pay-demo"

/**
 * Fetch currencies from Relay API
 *
 * @example
 * // Get default currencies for a chain
 * const { data } = useRelayCurrencies({ chainIds: [8453], defaultList: true })
 *
 * @example
 * // Search for a currency
 * const { data } = useRelayCurrencies({ term: "USDC", limit: 10 })
 *
 * @example
 * // Get a specific currency by address
 * const { data } = useRelayCurrencies({ chainIds: [1], address: "0x..." })
 */
export function useRelayCurrencies(params: CurrenciesV2RequestBody = {}, enabled = true) {
  // Include referrer in all requests for better rate limits
  const paramsWithReferrer = { ...params, referrer: REFERRER }

  return useQuery<Currency[]>({
    queryKey: ["relay", "currencies", paramsWithReferrer],
    queryFn: () => fetchCurrencies(paramsWithReferrer),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  })
}
