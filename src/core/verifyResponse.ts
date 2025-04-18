import crypto from "crypto";
import type { FonepayResponse } from "../types/index";
import { generateHmacSha512 } from "../utils/index";
import { RESPONSE_CODE } from "../types/index";

/**
 * Verifies the authenticity of a Fonepay payment response
 *
 * This function performs two key verifications:
 * 1. Checks if the payment was successful by validating the response code (RC)
 * 2. Verifies the data integrity by comparing the HMAC hash of the response parameters
 *    with the DV (Data Verification) value provided by Fonepay
 *
 * The verification process uses a timing-safe comparison to prevent timing attacks
 * when comparing the calculated hash with the received hash.
 *
 * @param response - The response object received from Fonepay after payment processing
 * @param secretKey - The merchant's secret key used for HMAC verification
 * @returns {boolean} True if the response is valid and payment was successful
 *
 * @example
 * ```typescript
 * const isValid = verifyResponse(fonepayResponse, merchantSecretKey);
 * if (isValid) {
 *   // Process successful payment
 * } else {
 *   // Handle invalid or failed payment
 * }
 * ```
 */
export function verifyResponse(
  response: FonepayResponse,
  secretKey: string
): boolean {
  try {
    // Validate input parameters
    if (!response || !secretKey) {
      throw new Error("Response and secret key are required");
    }

    if (response.RC !== RESPONSE_CODE.SUCCESSFUL) {
      console.info(
        `Payment verification failed: Response code was ${response.RC}`
      );
      return false;
    }

    const order = [
      "PRN",
      "PID",
      "PS",
      "RC",
      "UID",
      "BC",
      "INI",
      "P_AMT",
      "R_AMT",
    ];

    // Validate all required fields are present
    const missingFields = order.filter((field) => !(field in response));
    if (missingFields.length > 0) {
      throw new Error(
        `Missing required fields in response: ${missingFields.join(", ")}`
      );
    }

    const concatenatedValues = order
      .map((key) => response[key as keyof FonepayResponse])
      .join(",");

    const calculatedHash = generateHmacSha512(concatenatedValues, secretKey);
    if (!calculatedHash) {
      throw new Error("Failed to generate hash for response verification");
    }

    const calculatedDV = Buffer.from(calculatedHash, "hex");
    const fonepayDV = Buffer.from(response.DV, "hex");

    return crypto.timingSafeEqual(calculatedDV, fonepayDV);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error verifying Fonepay response:", errorMessage);
    return false;
  }
}
