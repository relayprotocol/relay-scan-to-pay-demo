import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply to wallet routes
        source: "/wallet/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://auth.privy.io https://*.privy.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "frame-src 'self' https://auth.privy.io https://*.privy.io https://*.walletconnect.com https://*.walletconnect.org",
              "connect-src 'self' https://api.relay.link https://*.relay.link https://*.arbitrum.io https://*.base.org https://*.optimism.io https://auth.privy.io https://*.privy.io https://*.privy.systems https://explorer-api.walletconnect.com https://*.walletconnect.com https://*.walletconnect.org https://*.infura.io https://*.alchemy.com https://*.ethereum.org https://*.polygon-rpc.com wss://*",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
