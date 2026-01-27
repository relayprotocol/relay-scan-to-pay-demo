"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface TokenIconProps {
  tokenLogoURI?: string | null
  tokenSymbol?: string | null
  chainIconUrl?: string | null
  size?: "sm" | "md" | "lg"
  showChainBadge?: boolean
  className?: string
}

const sizeConfig = {
  sm: {
    token: 24,
    badge: 12,
    badgeContainer: "w-3.5 h-3.5",
    fallbackText: "text-xs",
  },
  md: {
    token: 36,
    badge: 14,
    badgeContainer: "w-5 h-5",
    fallbackText: "text-sm",
  },
  lg: {
    token: 44,
    badge: 16,
    badgeContainer: "w-6 h-6",
    fallbackText: "text-base",
  },
}

export function TokenIcon({
  tokenLogoURI,
  tokenSymbol,
  chainIconUrl,
  size = "md",
  showChainBadge = true,
  className,
}: TokenIconProps) {
  const config = sizeConfig[size]

  return (
    <div className={cn("relative flex-shrink-0", className)}>
      {tokenLogoURI ? (
        <Image
          src={tokenLogoURI}
          alt={tokenSymbol || ""}
          width={config.token}
          height={config.token}
          className="rounded-full"
        />
      ) : (
        <div
          className={cn(
            "rounded-full bg-muted flex items-center justify-center font-medium",
            config.fallbackText
          )}
          style={{ width: config.token, height: config.token }}
        >
          {(tokenSymbol || "?").slice(0, 2)}
        </div>
      )}
      {showChainBadge && chainIconUrl && (
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 bg-background rounded-sm border border-border flex items-center justify-center",
            config.badgeContainer
          )}
        >
          <Image
            src={chainIconUrl}
            alt=""
            width={config.badge}
            height={config.badge}
            className="rounded-sm"
          />
        </div>
      )}
    </div>
  )
}

export function TokenIconSkeleton({
  size = "md",
  showChainBadge = true,
  className,
}: {
  size?: "sm" | "md" | "lg"
  showChainBadge?: boolean
  className?: string
}) {
  const config = sizeConfig[size]

  return (
    <div className={cn("relative flex-shrink-0", className)}>
      <Skeleton
        className="rounded-full"
        style={{ width: config.token, height: config.token }}
      />
      {showChainBadge && (
        <Skeleton
          className={cn("absolute -bottom-0.5 -right-0.5 rounded-sm", config.badgeContainer)}
        />
      )}
    </div>
  )
}
