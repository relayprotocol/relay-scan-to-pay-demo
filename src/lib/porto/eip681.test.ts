/**
 * EIP-681 Parser Tests
 *
 * Run with: npx tsx src/lib/porto/eip681.test.ts
 *
 * Comprehensive tests for EIP-681 parsing including:
 * - Basic ETH transfers
 * - Scientific notation
 * - ERC-20 token transfers
 * - Chain ID specification
 * - Gas parameters
 * - USD amount extension
 * - Edge cases and error handling
 */

import {
  parseEIP681,
  validatePayment,
  isValidAddress,
  parseScientificNotation,
  formatWeiToDisplay,
  parseAmountToWei,
  buildEIP681URI,
} from "./eip681";

// Simple test utilities
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (error) {
    failCount++;
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error instanceof Error ? error.message : error}`);
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
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
      }
    },
    toContain(expected: string) {
      if (typeof actual !== "string" || !actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== "number" || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
  };
}

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  console.log("=".repeat(name.length));
  fn();
}

// ============================================
// Address Validation Tests
// ============================================

describe("Address Validation", () => {
  test("validates correct lowercase address", () => {
    expect(isValidAddress("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359")).toBe(true);
  });

  test("validates correct checksummed address", () => {
    expect(isValidAddress("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359")).toBe(true);
  });

  test("rejects address without 0x prefix", () => {
    expect(isValidAddress("fb6916095ca1df60bb79ce92ce3ea74c37c5d359")).toBe(false);
  });

  test("rejects address with wrong length", () => {
    expect(isValidAddress("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d35")).toBe(false);
    expect(isValidAddress("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d3599")).toBe(false);
  });

  test("rejects address with invalid characters", () => {
    expect(isValidAddress("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d35g")).toBe(false);
  });
});

// ============================================
// Scientific Notation Parsing Tests
// ============================================

describe("Scientific Notation Parsing", () => {
  test("parses 1e18 correctly", () => {
    expect(parseScientificNotation("1e18")).toBe("1000000000000000000");
  });

  test("parses 2.014e18 correctly (from EIP-681 spec example)", () => {
    expect(parseScientificNotation("2.014e18")).toBe("2014000000000000000");
  });

  test("parses 1e9 correctly (gwei)", () => {
    expect(parseScientificNotation("1e9")).toBe("1000000000");
  });

  test("parses 20e9 correctly (20 gwei)", () => {
    expect(parseScientificNotation("20e9")).toBe("20000000000");
  });

  test("parses plain integer correctly", () => {
    expect(parseScientificNotation("1000000")).toBe("1000000");
  });

  test("parses 0.5e18 correctly", () => {
    expect(parseScientificNotation("0.5e18")).toBe("500000000000000000");
  });

  test("parses 1.5e18 correctly", () => {
    expect(parseScientificNotation("1.5e18")).toBe("1500000000000000000");
  });

  test("parses negative exponent (returns 0 for sub-wei)", () => {
    expect(parseScientificNotation("1e-1")).toBe("0");
  });

  test("handles uppercase E", () => {
    expect(parseScientificNotation("1E18")).toBe("1000000000000000000");
  });
});

// ============================================
// Basic EIP-681 Parsing Tests
// ============================================

describe("Basic EIP-681 Parsing", () => {
  test("parses simple ETH payment", () => {
    const result = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359?value=2.014e18"
    );
    expect(result).toBeTruthy();
    expect(result!.to).toBe("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359");
    expect(result!.value).toBe("2014000000000000000");
    expect(result!.chainId).toBe(1);
    expect(result!.isERC20).toBe(false);
  });

  test("parses payment with chain ID", () => {
    const result = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359@137?value=1e18"
    );
    expect(result).toBeTruthy();
    expect(result!.chainId).toBe(137);
    expect(result!.value).toBe("1000000000000000000");
  });

  test("parses plain address (no parameters)", () => {
    const result = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359"
    );
    expect(result).toBeTruthy();
    expect(result!.to).toBe("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359");
    expect(result!.value).toBe(undefined);
    expect(result!.chainId).toBe(1);
  });

  test("parses payment with gas parameters", () => {
    const result = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359?value=1e18&gas=21000&gasPrice=20e9"
    );
    expect(result).toBeTruthy();
    expect(result!.value).toBe("1000000000000000000");
    expect(result!.gas).toBe("21000");
    expect(result!.gasPrice).toBe("20000000000");
  });

  test("accepts plain address without ethereum: prefix", () => {
    const result = parseEIP681("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359");
    expect(result).toBeTruthy();
    expect(result!.to).toBe("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359");
    expect(result!.chainId).toBe(1);
  });
});

// ============================================
// ERC-20 Token Transfer Tests
// ============================================

describe("ERC-20 Token Transfer Parsing", () => {
  test("parses ERC-20 transfer (USDC example)", () => {
    const result = parseEIP681(
      "ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/transfer?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1000000"
    );
    expect(result).toBeTruthy();
    expect(result!.isERC20).toBe(true);
    expect(result!.tokenAddress).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    expect(result!.recipient).toBe("0x8e23ee67d1332ad560396262c48ffbb01f93d052");
    expect(result!.value).toBe("1000000"); // 1 USDC (6 decimals)
    expect(result!.functionName).toBe("transfer");
  });

  test("parses ERC-20 transfer with scientific notation amount", () => {
    const result = parseEIP681(
      "ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/transfer?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1e6"
    );
    expect(result).toBeTruthy();
    expect(result!.value).toBe("1000000"); // 1 USDC
  });

  test("parses ERC-20 with chain ID", () => {
    const result = parseEIP681(
      "ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=100e6"
    );
    expect(result).toBeTruthy();
    expect(result!.chainId).toBe(8453); // Base
    expect(result!.tokenAddress).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(result!.value).toBe("100000000"); // 100 USDC
  });
});

// ============================================
// USD Amount Extension Tests
// ============================================

describe("USD Amount Extension", () => {
  test("parses usdAmount parameter", () => {
    const result = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359?usdAmount=25.00"
    );
    expect(result).toBeTruthy();
    expect(result!.usdAmount).toBe("25.00");
    expect(result!.value).toBe(undefined);
  });

  test("parses both value and usdAmount", () => {
    const result = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359?value=0.0083e18&usdAmount=25.00"
    );
    expect(result).toBeTruthy();
    expect(result!.value).toBe("8300000000000000");
    expect(result!.usdAmount).toBe("25.00");
  });

  test("parses ERC-20 transfer with usdAmount", () => {
    const result = parseEIP681(
      "ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/transfer?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=100000000&usdAmount=100.00"
    );
    expect(result).toBeTruthy();
    expect(result!.usdAmount).toBe("100.00");
    expect(result!.value).toBe("100000000"); // 100 USDC (6 decimals)
    expect(result!.isERC20).toBe(true);
  });
});

// ============================================
// Error Handling Tests
// ============================================

describe("Error Handling", () => {
  test("returns null for invalid address", () => {
    const result = parseEIP681("ethereum:0xinvalid");
    expect(result).toBeNull();
  });

  test("returns null for empty URI", () => {
    const result = parseEIP681("ethereum:");
    expect(result).toBeNull();
  });

  test("returns null for non-ethereum URI", () => {
    const result = parseEIP681("bitcoin:1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2");
    expect(result).toBeNull();
  });

  test("returns null for malformed URI", () => {
    const result = parseEIP681("not-a-valid-uri");
    expect(result).toBeNull();
  });

  test("handles invalid chain ID gracefully (defaults to 1)", () => {
    const result = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359@invalid?value=1e18"
    );
    expect(result).toBeTruthy();
    expect(result!.chainId).toBe(1);
  });
});

// ============================================
// Payment Validation Tests
// ============================================

describe("Payment Validation", () => {
  test("validates correct payment", () => {
    const payment = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359?value=1e18"
    )!;
    const validation = validatePayment(payment);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  test("warns about missing amount for native transfer", () => {
    const payment = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359"
    )!;
    const validation = validatePayment(payment);
    expect(validation.valid).toBe(true); // Still valid, just a warning
    expect(validation.warnings.length).toBeGreaterThan(0);
  });

  test("errors on ERC-20 without recipient", () => {
    // Manually create invalid payment (missing recipient)
    const payment = {
      to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      chainId: 1,
      isERC20: true,
      functionName: "transfer",
      tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    };
    const validation = validatePayment(payment);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("recipient"))).toBe(true);
  });
});

// ============================================
// Wei Formatting Tests
// ============================================

describe("Wei Formatting", () => {
  test("formats 1 ETH correctly", () => {
    expect(formatWeiToDisplay("1000000000000000000")).toBe("1");
  });

  test("formats 0.5 ETH correctly", () => {
    expect(formatWeiToDisplay("500000000000000000")).toBe("0.5");
  });

  test("formats 1.5 ETH correctly", () => {
    expect(formatWeiToDisplay("1500000000000000000")).toBe("1.5");
  });

  test("formats 0 correctly", () => {
    expect(formatWeiToDisplay("0")).toBe("0");
  });

  test("formats 1 USDC correctly (6 decimals)", () => {
    expect(formatWeiToDisplay("1000000", 6)).toBe("1");
  });

  test("formats 100 USDC correctly (6 decimals)", () => {
    expect(formatWeiToDisplay("100000000", 6)).toBe("100");
  });

  test("formats 1.50 USDC correctly (6 decimals)", () => {
    expect(formatWeiToDisplay("1500000", 6)).toBe("1.5");
  });
});

// ============================================
// Amount to Wei Conversion Tests
// ============================================

describe("Amount to Wei Conversion", () => {
  test("converts 1 ETH to wei", () => {
    expect(parseAmountToWei("1")).toBe("1000000000000000000");
  });

  test("converts 0.5 ETH to wei", () => {
    expect(parseAmountToWei("0.5")).toBe("500000000000000000");
  });

  test("converts 1.5 ETH to wei", () => {
    expect(parseAmountToWei("1.5")).toBe("1500000000000000000");
  });

  test("converts 1 USDC to atomic units (6 decimals)", () => {
    expect(parseAmountToWei("1", 6)).toBe("1000000");
  });

  test("converts 100 USDC to atomic units", () => {
    expect(parseAmountToWei("100", 6)).toBe("100000000");
  });
});

// ============================================
// URI Building Tests
// ============================================

describe("URI Building", () => {
  test("builds simple ETH payment URI", () => {
    const uri = buildEIP681URI({
      to: "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359",
      value: "1000000000000000000",
    });
    expect(uri).toContain("ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359");
    expect(uri).toContain("value=1000000000000000000");
  });

  test("builds URI with chain ID", () => {
    const uri = buildEIP681URI({
      to: "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359",
      chainId: 137,
      value: "1000000000000000000",
    });
    expect(uri).toContain("@137");
  });

  test("builds URI with usdAmount", () => {
    const uri = buildEIP681URI({
      to: "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359",
      usdAmount: "25.00",
    });
    expect(uri).toContain("usdAmount=25.00");
  });

  test("builds ERC-20 transfer URI", () => {
    const uri = buildEIP681URI({
      to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      functionName: "transfer",
      parameters: {
        address: "0x8e23ee67d1332ad560396262c48ffbb01f93d052",
        uint256: "1000000",
      },
    });
    expect(uri).toContain("/transfer");
    expect(uri).toContain("address=");
    expect(uri).toContain("uint256=1000000");
  });
});

// ============================================
// MetaMask Bug Reproduction Tests
// ============================================

describe("MetaMask Bug Fixes (Our Parser Should Handle These)", () => {
  test("correctly extracts value parameter (MetaMask #4332 - ignores value)", () => {
    // MetaMask Mobile ignores the value parameter entirely
    const result = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359?value=2.014e18"
    );
    expect(result).toBeTruthy();
    expect(result!.value).toBe("2014000000000000000");
  });

  test("treats uint256 as atomic units, not main units (MetaMask #1549)", () => {
    // MetaMask treats uint256 as main units instead of atomic units
    // 1 USDC should be uint256=1000000, NOT uint256=1
    const result = parseEIP681(
      "ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/transfer?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1000000"
    );
    expect(result).toBeTruthy();
    // We correctly preserve the atomic units value
    expect(result!.value).toBe("1000000");
    // NOT converting it incorrectly like MetaMask does
  });

  test("handles complex EIP-681 URI with all parameters", () => {
    const result = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359@1?value=2.014e18&gas=21000&gasPrice=20e9"
    );
    expect(result).toBeTruthy();
    expect(result!.to).toBe("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359");
    expect(result!.chainId).toBe(1);
    expect(result!.value).toBe("2014000000000000000");
    expect(result!.gas).toBe("21000");
    expect(result!.gasPrice).toBe("20000000000");
  });
});

// ============================================
// Round-trip Tests
// ============================================

describe("Round-trip Tests (parse -> build -> parse)", () => {
  test("round-trips basic ETH payment", () => {
    const original =
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359?value=1000000000000000000";
    const parsed = parseEIP681(original)!;
    const rebuilt = buildEIP681URI(parsed);
    const reparsed = parseEIP681(rebuilt)!;

    expect(reparsed.to).toBe(parsed.to);
    expect(reparsed.value).toBe(parsed.value);
    expect(reparsed.chainId).toBe(parsed.chainId);
  });

  test("round-trips payment with chain ID", () => {
    const parsed = parseEIP681(
      "ethereum:0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359@137?value=1000000000000000000"
    )!;
    const rebuilt = buildEIP681URI(parsed);
    const reparsed = parseEIP681(rebuilt)!;

    expect(reparsed.chainId).toBe(137);
    expect(reparsed.value).toBe(parsed.value);
  });
});

// ============================================
// Run Tests
// ============================================

console.log("\n🧪 EIP-681 Parser Tests\n");
console.log("=".repeat(50));

// All tests are automatically run when the describe blocks are executed

console.log("\n" + "=".repeat(50));
console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed\n`);

if (failCount > 0) {
  process.exit(1);
}
