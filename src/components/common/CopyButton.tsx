"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"

interface CopyButtonProps {
  value: string
  className?: string
}

export function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }, [value])

  return (
    <span className="relative group inline-flex">
      <button
        onClick={handleCopy}
        className={cn(
          "p-1.5 rounded-md hover:bg-muted transition-colors",
          className
        )}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
      >
        <span className="relative block w-4 h-4">
          {/* Copy icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "w-4 h-4 absolute inset-0 transition-all duration-200",
              copied ? "opacity-0 scale-50" : "opacity-100 scale-100"
            )}
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>

          {/* Check icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "w-4 h-4 absolute inset-0 text-green-500 transition-all duration-200",
              copied ? "opacity-100 scale-100" : "opacity-0 scale-50"
            )}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      </button>

      {/* Tooltip */}
      <span
        className={cn(
          "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs rounded bg-foreground text-background whitespace-nowrap",
          "opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        )}
      >
        {copied ? "Copied!" : "Copy"}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
      </span>
    </span>
  )
}

interface AddressDisplayProps {
  address: string
  truncateStart?: number
  truncateEnd?: number
  className?: string
  showCopy?: boolean
}

export function AddressDisplay({
  address,
  truncateStart = 6,
  truncateEnd = 4,
  className,
  showCopy = true,
}: AddressDisplayProps) {
  const truncated =
    address.length <= truncateStart + truncateEnd
      ? address
      : `${address.slice(0, truncateStart)}...${address.slice(-truncateEnd)}`

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="font-mono">{truncated}</span>
      {showCopy && <CopyButton value={address} />}
    </span>
  )
}
