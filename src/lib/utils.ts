import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Truncate an address to show first and last characters
 * @param address - The address to truncate
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 */
export function truncateAddress(
  address: string | undefined,
  startChars = 6,
  endChars = 4
): string {
  if (!address) return ""
  if (address.length <= startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Extract error message from various error types (axios, API responses, etc.)
 */
export function getErrorMessage(error: Error): string {
  // Check for axios error with response data
  const axiosError = error as Error & {
    response?: { data?: { message?: string } }
  }
  if (axiosError.response?.data?.message) {
    return axiosError.response.data.message
  }
  return error.message || "An error occurred"
}

/**
 * Format a USD amount string to a display value with 2 decimal places
 * Shows "<$0.01" for very small amounts
 */
export function formatUsd(amount: string | number | undefined): string {
  if (amount === undefined || amount === null || amount === "") {
    return "$0.00"
  }

  const num = typeof amount === "string" ? parseFloat(amount) : amount

  if (isNaN(num)) {
    return "$0.00"
  }

  if (num > 0 && num < 0.01) {
    return "<$0.01"
  }

  return `$${num.toFixed(2)}`
}
