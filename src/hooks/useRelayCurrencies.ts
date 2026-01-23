"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchCurrencies, type CurrenciesV2RequestBody, type Currency } from "@/lib/relay"

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
  return useQuery<Currency[]>({
    queryKey: ["relay", "currencies", params],
    queryFn: () => fetchCurrencies(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  })
}
