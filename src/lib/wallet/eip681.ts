/**
 * EIP-681 Parser with USD Amount Extension
 *
 * Robust parser for Ethereum payment URIs that correctly handles:
 * - Basic ETH transfers with value
 * - ERC-20 token transfers (contract + function params)
 * - Chain ID specification
 * - Gas parameters
 * - Scientific notation (e.g., 2.014e18)
 * - Our custom usdAmount parameter for USD-denominated payments
 *
 * This parser fixes issues found in MetaMask and other wallets:
 * - MetaMask ignores the `value` parameter
 * - MetaMask treats ERC-20 uint256 as main units instead of atomic units
 *
 * @see https://eips.ethereum.org/EIPS/eip-681
 */

import type { ParsedPayment } from "./types";

/**
 * Ethereum address regex (checksummed or lowercase)
 */
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Valid EIP-681 parameter names (standard + our extension)
 */
const VALID_PARAMS = new Set([
  "value",
  "gas",
  "gasLimit",
  "gasPrice",
  "data",
  // Our extensions
  "usdAmount",
  "merchantName",
  "description",
  "imageUrl",
  // Common ERC-20 function params
  "address",
  "uint256",
  "amount",
  "to",
  "_to",
  "_value",
  "_amount",
]);

/**
 * Validate an Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return ADDRESS_REGEX.test(address);
}

/**
 * Parse scientific notation to wei string
 * Handles values like "2.014e18" correctly
 *
 * @param value - Value string, possibly in scientific notation
 * @returns Value as a full integer string (no decimals)
 */
export function parseScientificNotation(value: string): string {
  // Handle scientific notation
  if (value.toLowerCase().includes("e")) {
    const [mantissa, exponent] = value.toLowerCase().split("e");
    const exp = parseInt(exponent, 10);
    const [intPart, decPart = ""] = mantissa.split(".");

    if (exp >= 0) {
      // Positive exponent: shift decimal right
      const totalDigits = intPart + decPart;
      const decimalShift = exp - decPart.length;

      if (decimalShift >= 0) {
        // Pad with zeros and remove leading zeros
        const result = totalDigits + "0".repeat(decimalShift);
        return result.replace(/^0+/, "") || "0";
      } else {
        // Insert decimal point (but we want integer result)
        // This means we have a fractional wei which isn't valid
        // Round to nearest integer
        const insertAt = totalDigits.length + decimalShift;
        const integerPart = totalDigits.slice(0, insertAt);
        const fractionalPart = totalDigits.slice(insertAt);

        // Round based on first fractional digit
        if (fractionalPart.length > 0 && parseInt(fractionalPart[0]) >= 5) {
          return (BigInt(integerPart || "0") + BigInt(1)).toString();
        }
        // Remove leading zeros
        return integerPart.replace(/^0+/, "") || "0";
      }
    } else {
      // Negative exponent: shift decimal left (result < 1)
      // This would result in fractional wei, which rounds to 0
      return "0";
    }
  }

  // Handle plain decimal numbers
  if (value.includes(".")) {
    const [intPart, decPart] = value.split(".");
    // Decimal values in wei context should be whole numbers
    // If there's a decimal, it's likely a mistake - use just the integer part
    console.warn(
      `Warning: Decimal value "${value}" in wei context. Using integer part only.`,
    );
    return intPart || "0";
  }

  // Plain integer
  return value;
}

/**
 * Parse an EIP-681 URI into structured payment data
 *
 * Format: ethereum:<address>[@<chainId>][/<function>][?<parameters>]
 *
 * @param uri - The EIP-681 URI string
 * @returns Parsed payment data or null if invalid
 */
export function parseEIP681(uri: string): ParsedPayment | null {
  // Normalize and validate prefix
  const normalizedUri = uri.trim();

  // Check for ethereum: prefix
  if (!normalizedUri.toLowerCase().startsWith("ethereum:")) {
    // Also accept plain addresses for convenience
    if (isValidAddress(normalizedUri)) {
      return {
        to: normalizedUri,
        chainId: 1,
        isERC20: false,
      };
    }
    return null;
  }

  // Remove prefix
  let remaining = normalizedUri.slice("ethereum:".length);

  // Handle empty URI
  if (!remaining) {
    return null;
  }

  // Extract parameters (after ?)
  let paramString = "";
  const paramIndex = remaining.indexOf("?");
  if (paramIndex !== -1) {
    paramString = remaining.slice(paramIndex + 1);
    remaining = remaining.slice(0, paramIndex);
  }

  // Extract function name (after /)
  let functionName: string | undefined;
  const funcIndex = remaining.indexOf("/");
  if (funcIndex !== -1) {
    functionName = remaining.slice(funcIndex + 1);
    remaining = remaining.slice(0, funcIndex);
  }

  // Extract chain ID (after @)
  let chainId = 1; // Default to mainnet
  const chainIndex = remaining.indexOf("@");
  if (chainIndex !== -1) {
    const chainIdStr = remaining.slice(chainIndex + 1);
    chainId = parseInt(chainIdStr, 10);
    if (isNaN(chainId) || chainId <= 0) {
      console.warn(`Invalid chain ID: ${chainIdStr}, defaulting to 1`);
      chainId = 1;
    }
    remaining = remaining.slice(0, chainIndex);
  }

  // Remaining should be the address
  const targetAddress = remaining;
  if (!isValidAddress(targetAddress)) {
    console.error(`Invalid Ethereum address: ${targetAddress}`);
    return null;
  }

  // Parse query parameters
  const parameters: Record<string, string> = {};
  if (paramString) {
    const params = new URLSearchParams(paramString);
    params.forEach((value, key) => {
      parameters[key] = value;
    });
  }

  // Extract standard EIP-681 parameters
  const value = parameters.value
    ? parseScientificNotation(parameters.value)
    : undefined;
  const gas = parameters.gas || parameters.gasLimit;
  const gasPrice = parameters.gasPrice
    ? parseScientificNotation(parameters.gasPrice)
    : undefined;

  // Extract our custom extensions
  const usdAmount = parameters.usdAmount;
  const merchantName = parameters.merchantName;
  const description = parameters.description;
  const imageUrl = parameters.imageUrl;

  // Determine if this is an ERC-20 transfer
  const isERC20 =
    functionName === "transfer" || functionName === "transferFrom";

  // For ERC-20 transfers, extract recipient and amount from parameters
  let recipient: string | undefined;
  let tokenAmount: string | undefined;

  if (isERC20) {
    // ERC-20 transfer parameters: address (recipient), uint256 (amount)
    recipient = parameters.address || parameters.to || parameters._to;

    tokenAmount =
      parameters.uint256 ||
      parameters.amount ||
      parameters._amount ||
      parameters._value;

    // Validate recipient address
    if (recipient && !isValidAddress(recipient)) {
      console.error(`Invalid recipient address: ${recipient}`);
      return null;
    }

    // Parse token amount from scientific notation if present
    if (tokenAmount) {
      tokenAmount = parseScientificNotation(tokenAmount);
    }
  }

  // Build cleaned parameters (function params only, not standard EIP-681 params)
  const cleanedParams: Record<string, string> = {};
  for (const [key, val] of Object.entries(parameters)) {
    if (
      key !== "value" &&
      key !== "gas" &&
      key !== "gasLimit" &&
      key !== "gasPrice" &&
      key !== "usdAmount" &&
      key !== "merchantName" &&
      key !== "description" &&
      key !== "imageUrl"
    ) {
      // For uint256, ensure it's parsed correctly
      if (
        key === "uint256" ||
        key === "amount" ||
        key === "_amount" ||
        key === "_value"
      ) {
        cleanedParams[key] = parseScientificNotation(val);
      } else {
        cleanedParams[key] = val;
      }
    }
  }

  return {
    to: targetAddress,
    value: isERC20 ? tokenAmount : value,
    usdAmount,
    chainId,
    functionName,
    parameters:
      Object.keys(cleanedParams).length > 0 ? cleanedParams : undefined,
    gas,
    gasPrice,
    isERC20,
    tokenAddress: isERC20 ? targetAddress : undefined,
    recipient: isERC20 ? recipient : targetAddress,
    merchantName,
    description,
    imageUrl,
  };
}

/**
 * Validate a parsed payment
 *
 * @param payment - Parsed payment to validate
 * @returns Object with validity and error messages
 */
export function validatePayment(payment: ParsedPayment): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Must have a valid target address
  if (!payment.to || !isValidAddress(payment.to)) {
    errors.push("Invalid or missing target address");
  }

  // Must have either value or usdAmount for transfers
  if (!payment.value && !payment.usdAmount) {
    if (!payment.isERC20) {
      warnings.push("No amount specified - user will need to enter amount");
    } else if (payment.isERC20 && !payment.parameters?.uint256) {
      errors.push("ERC-20 transfer requires uint256 amount");
    }
  }

  // For ERC-20, must have recipient
  if (payment.isERC20 && !payment.recipient) {
    errors.push("ERC-20 transfer requires recipient address");
  }

  // Validate chain ID is reasonable
  if (payment.chainId <= 0) {
    errors.push("Invalid chain ID");
  }

  // Check for very large values that might indicate parsing errors
  if (payment.value) {
    try {
      const valueBigInt = BigInt(payment.value);
      // Warn if value seems unreasonably large (> 1 billion ETH worth)
      if (valueBigInt > BigInt("1000000000000000000000000000")) {
        warnings.push("Value seems extremely large - please verify amount");
      }
    } catch {
      errors.push("Invalid value format");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format a wei value to human-readable string
 *
 * @param wei - Value in wei
 * @param decimals - Token decimals (default 18 for ETH)
 * @returns Formatted string with reasonable precision
 */
export function formatWeiToDisplay(wei: string, decimals = 18): string {
  try {
    const weiBigInt = BigInt(wei);
    const divisor = BigInt(10 ** decimals);
    const wholePart = weiBigInt / divisor;
    const remainder = weiBigInt % divisor;

    if (remainder === BigInt(0)) {
      return wholePart.toString();
    }

    // Format with decimals
    const remainderStr = remainder.toString().padStart(decimals, "0");
    // Trim trailing zeros but keep at least 2 decimal places for small amounts
    let trimmed = remainderStr.replace(/0+$/, "");
    if (trimmed.length === 0) {
      return wholePart.toString();
    }
    // Limit to 8 decimal places for display
    trimmed = trimmed.slice(0, 8);

    return `${wholePart}.${trimmed}`;
  } catch {
    return "0";
  }
}

/**
 * Convert a human-readable amount to wei
 *
 * @param amount - Human-readable amount (e.g., "1.5")
 * @param decimals - Token decimals (default 18 for ETH)
 * @returns Value in wei as string
 */
export function parseAmountToWei(amount: string, decimals = 18): string {
  const [intPart, decPart = ""] = amount.split(".");

  // Pad or truncate decimal part to match decimals
  const paddedDecimal = decPart.padEnd(decimals, "0").slice(0, decimals);

  // Combine and remove leading zeros
  const combined = intPart + paddedDecimal;
  const result = combined.replace(/^0+/, "") || "0";

  return result;
}

/**
 * Build an EIP-681 URI from payment data
 *
 * @param payment - Payment data to encode
 * @returns EIP-681 compliant URI string
 */
export function buildEIP681URI(payment: Partial<ParsedPayment>): string {
  if (!payment.to) {
    throw new Error("Target address is required");
  }

  let uri = `ethereum:${payment.to}`;

  // Add chain ID if not mainnet
  if (payment.chainId && payment.chainId !== 1) {
    uri += `@${payment.chainId}`;
  }

  // Add function name for contract calls
  if (payment.functionName) {
    uri += `/${payment.functionName}`;
  }

  // Build query parameters
  const params = new URLSearchParams();

  if (payment.value) {
    params.set("value", payment.value);
  }

  if (payment.usdAmount) {
    params.set("usdAmount", payment.usdAmount);
  }

  if (payment.merchantName) {
    params.set("merchantName", payment.merchantName);
  }

  if (payment.description) {
    params.set("description", payment.description);
  }

  if (payment.gas) {
    params.set("gas", payment.gas);
  }

  if (payment.gasPrice) {
    params.set("gasPrice", payment.gasPrice);
  }

  // Add function parameters
  if (payment.parameters) {
    for (const [key, value] of Object.entries(payment.parameters)) {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  if (queryString) {
    uri += `?${queryString}`;
  }

  return uri;
}
