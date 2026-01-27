"use client"

import { useMemo } from "react"
import { formatUnits, erc20Abi, type Address } from "viem"
import { useBalance, useReadContract } from "wagmi"

const NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000"

interface UseTokenBalanceParams {
  address?: Address
  chainId?: number
  tokenAddress?: string
  decimals?: number
  enabled?: boolean
}

interface UseTokenBalanceResult {
  balance: bigint | undefined
  formatted: string | null
  decimals: number
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useTokenBalance({
  address,
  chainId,
  tokenAddress,
  decimals = 18,
  enabled = true,
}: UseTokenBalanceParams): UseTokenBalanceResult {
  const isNative = !tokenAddress || tokenAddress === NATIVE_ADDRESS

  // Native balance query
  const {
    data: nativeBalance,
    isLoading: isLoadingNative,
    isError: isErrorNative,
    refetch: refetchNative,
  } = useBalance({
    address,
    chainId,
    query: {
      enabled: enabled && !!address && !!chainId && isNative,
    },
  })

  // ERC20 balance query
  const {
    data: erc20Balance,
    isLoading: isLoadingErc20,
    isError: isErrorErc20,
    refetch: refetchErc20,
  } = useReadContract({
    address: tokenAddress as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: enabled && !!address && !!chainId && !isNative && !!tokenAddress,
    },
  })

  const balance = isNative ? nativeBalance?.value : erc20Balance
  const resolvedDecimals = isNative ? (nativeBalance?.decimals ?? 18) : decimals

  const formatted = useMemo(() => {
    if (balance === undefined) return null
    return formatUnits(balance, resolvedDecimals)
  }, [balance, resolvedDecimals])

  const refetch = isNative ? refetchNative : refetchErc20

  return {
    balance,
    formatted,
    decimals: resolvedDecimals,
    isLoading: isNative ? isLoadingNative : isLoadingErc20,
    isError: isNative ? isErrorNative : isErrorErc20,
    refetch,
  }
}
