import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "@/providers"
import { fetchChains } from "@/lib/relay"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Relay Scan to Pay",
  description: "Crypto payments for physical checkout flows powered by Relay",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Relay Pay",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Fetch chains server-side
  let chains: Awaited<ReturnType<typeof fetchChains>> = []
  try {
    chains = await fetchChains()
  } catch (error) {
    console.error("Failed to fetch chains:", error)
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers chains={chains}>{children}</Providers>
      </body>
    </html>
  )
}
