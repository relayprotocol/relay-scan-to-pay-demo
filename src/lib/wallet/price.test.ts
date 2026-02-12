/**
 * Relay Price API Tests
 *
 * Run with: npx tsx src/lib/wallet/price.test.ts
 *
 * Tests for USD ↔ crypto conversions and price validation.
 * Note: Some tests require network access to the Relay API.
 */

import {
  getTokenPrice,
  getNativeTokenPrice,
  convertUSDToWei,
  convertWeiToUSD,
  validateConversion,
  getTokenConfig,
  formatPriceDisplay,
  formatExchangeRate,
  clearPriceCache,
} from "./price";

// Simple test utilities
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result instanceof Promise) {
    return result
      .then(() => {
        passCount++;
        console.log(`✓ ${name}`);
      })
      .catch((error) => {
        failCount++;
        console.log(`✗ ${name}`);
        console.log(`  Error: ${error instanceof Error ? error.message : error}`);
      });
  } else {
    try {
      passCount++;
      console.log(`✓ ${name}`);
    } catch (error) {
      failCount++;
      console.log(`✗ ${name}`);
      console.log(`  Error: ${error instanceof Error ? error.message : error}`);
    }
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== "number" || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      if (typeof actual !== "number" || actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toContain(expected: string) {
      if (typeof actual !== "string" || !actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
  };
}

function describe(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  console.log("=".repeat(name.length));
  return fn();
}

async function runTests() {
  console.log("\n🧪 Relay Price API Tests\n");
  console.log("=".repeat(50));

  // Clear cache before tests
  clearPriceCache();

  // ============================================
  // Token Config Tests
  // ============================================

  describe("Token Configuration", () => {
    test("returns ETH config for native token on mainnet", () => {
      const config = getTokenConfig(undefined, 1);
      expect(config.symbol).toBe("ETH");
      expect(config.decimals).toBe(18);
      expect(config.isStablecoin).toBe(false);
    });

    test("returns ETH config for zero address", () => {
      const config = getTokenConfig(
        "0x0000000000000000000000000000000000000000",
        1
      );
      expect(config.symbol).toBe("ETH");
      expect(config.decimals).toBe(18);
    });

    test("returns MATIC config for Polygon native token", () => {
      const config = getTokenConfig(undefined, 137);
      expect(config.symbol).toBe("MATIC");
      expect(config.decimals).toBe(18);
    });

    test("returns USDC config for known USDC address", () => {
      const config = getTokenConfig(
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        1
      );
      expect(config.symbol).toBe("USDC");
      expect(config.decimals).toBe(6);
      expect(config.isStablecoin).toBe(true);
    });

    test("returns USDC config for Base USDC", () => {
      const config = getTokenConfig(
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        8453
      );
      expect(config.symbol).toBe("USDC");
      expect(config.decimals).toBe(6);
      expect(config.isStablecoin).toBe(true);
    });

    test("returns default config for unknown token", () => {
      const config = getTokenConfig(
        "0x1234567890123456789012345678901234567890",
        1
      );
      expect(config.symbol).toBe("TOKEN");
      expect(config.decimals).toBe(18);
      expect(config.isStablecoin).toBe(false);
    });
  });

  // ============================================
  // USD to Wei Conversion Tests
  // ============================================

  describe("USD to Wei Conversion", () => {
    test("converts $1 at $3000/ETH", () => {
      // $1 / $3000 = 0.000333... ETH = 333333333333333 wei (approx)
      const wei = convertUSDToWei("1", 3000);
      const weiNum = BigInt(wei);
      // Should be approximately 333333333333333 (allow some variance)
      expect(weiNum > BigInt("333000000000000")).toBeTruthy();
      expect(weiNum < BigInt("334000000000000")).toBeTruthy();
    });

    test("converts $100 at $3000/ETH", () => {
      // $100 / $3000 = 0.0333... ETH
      const wei = convertUSDToWei("100", 3000);
      const weiNum = BigInt(wei);
      expect(weiNum > BigInt("33000000000000000")).toBeTruthy();
      expect(weiNum < BigInt("34000000000000000")).toBeTruthy();
    });

    test("converts $100 USDC at $1/USDC (6 decimals)", () => {
      // $100 / $1 = 100 USDC = 100000000 (6 decimals)
      const wei = convertUSDToWei("100", 1, 6);
      expect(wei).toBe("100000000");
    });

    test("throws on invalid USD amount", () => {
      let threw = false;
      try {
        convertUSDToWei("invalid", 3000);
      } catch {
        threw = true;
      }
      expect(threw).toBeTruthy();
    });

    test("throws on zero USD amount", () => {
      let threw = false;
      try {
        convertUSDToWei("0", 3000);
      } catch {
        threw = true;
      }
      expect(threw).toBeTruthy();
    });
  });

  // ============================================
  // Wei to USD Conversion Tests
  // ============================================

  describe("Wei to USD Conversion", () => {
    test("converts 1 ETH at $3000", () => {
      const usd = convertWeiToUSD("1000000000000000000", 3000);
      expect(usd).toBe("3000.00");
    });

    test("converts 0.5 ETH at $3000", () => {
      const usd = convertWeiToUSD("500000000000000000", 3000);
      expect(usd).toBe("1500.00");
    });

    test("converts 1 USDC at $1 (6 decimals)", () => {
      const usd = convertWeiToUSD("1000000", 1, 6);
      expect(usd).toBe("1.00");
    });

    test("converts 100 USDC at $1", () => {
      const usd = convertWeiToUSD("100000000", 1, 6);
      expect(usd).toBe("100.00");
    });

    test("handles zero wei", () => {
      const usd = convertWeiToUSD("0", 3000);
      expect(usd).toBe("0.00");
    });
  });

  // ============================================
  // Price Validation Tests
  // ============================================

  describe("Price Validation", () => {
    test("validates matching price (within 5%)", () => {
      // 1 ETH at $3000 should validate against $3000
      const result = validateConversion(
        "1000000000000000000", // 1 ETH
        "3000", // $3000
        3000 // current price
      );
      expect(result.valid).toBeTruthy();
    });

    test("validates price within 5% tolerance", () => {
      // 1 ETH at $3000, but claiming $3100 (3.3% off)
      const result = validateConversion(
        "1000000000000000000", // 1 ETH
        "3100", // $3100 (slightly off)
        3000 // current price
      );
      expect(result.valid).toBeTruthy();
      expect(result.discrepancy).toBeTruthy();
      expect(result.discrepancy!).toBeLessThan(0.05);
    });

    test("rejects price beyond 5% tolerance", () => {
      // 1 ETH at $3000, but claiming $4000 (33% off)
      const result = validateConversion(
        "1000000000000000000", // 1 ETH
        "4000", // $4000 (way off)
        3000 // current price
      );
      expect(result.valid).toBeFalsy();
      expect(result.discrepancy).toBeGreaterThan(0.05);
      expect(result.message).toBeTruthy();
    });

    test("handles stablecoin validation", () => {
      // 100 USDC should be ~$100
      const result = validateConversion(
        "100000000", // 100 USDC (6 decimals)
        "100", // $100
        1, // $1 per USDC
        6 // USDC decimals
      );
      expect(result.valid).toBeTruthy();
    });
  });

  // ============================================
  // Formatting Tests
  // ============================================

  describe("Formatting", () => {
    test("formats price display correctly", () => {
      const display = formatPriceDisplay("25.00", "0.0083", "ETH");
      expect(display).toContain("$25.00");
      expect(display).toContain("0.0083");
      expect(display).toContain("ETH");
    });

    test("formats exchange rate correctly", () => {
      const rate = formatExchangeRate(3000.45, "ETH");
      expect(rate).toContain("1 ETH");
      expect(rate).toContain("$3,000.45");
    });

    test("formats large exchange rate with commas", () => {
      const rate = formatExchangeRate(45000, "BTC");
      expect(rate).toContain("1 BTC");
      expect(rate).toContain("$45,000.00");
    });
  });

  // ============================================
  // Live API Tests (require network)
  // ============================================

  await describe("Live Relay Price API (requires network)", async () => {
    await test("fetches ETH price from Relay API", async () => {
      const price = await getTokenPrice({
        currency: "eth",
        chainId: 1,
        toCurrency: "usd",
      });
      expect(price).toBeGreaterThan(0);
      console.log(`    ETH price: $${price.toFixed(2)}`);
    });

    await test("fetches native token price for mainnet", async () => {
      const price = await getNativeTokenPrice(1);
      expect(price).toBeGreaterThan(0);
    });

    await test("caches price for subsequent calls", async () => {
      // First call (may be cached from previous test)
      const price1 = await getTokenPrice({
        currency: "eth",
        chainId: 1,
        toCurrency: "usd",
      });

      // Second call should return same (cached) value
      const price2 = await getTokenPrice({
        currency: "eth",
        chainId: 1,
        toCurrency: "usd",
      });

      expect(price1).toBe(price2);
    });

    await test("fetches USDC price (should be ~$1)", async () => {
      const price = await getTokenPrice({
        currency: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        chainId: 1,
        toCurrency: "usd",
      });
      // USDC should be between $0.99 and $1.01
      expect(price).toBeGreaterThan(0.99);
      expect(price).toBeLessThan(1.01);
      console.log(`    USDC price: $${price.toFixed(4)}`);
    });
  });

  // ============================================
  // Results
  // ============================================

  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
