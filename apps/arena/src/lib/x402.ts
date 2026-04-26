/**
 * x402 payment middleware (powered by @okxweb3/x402-* SDK).
 *
 * Wraps the OKX facilitator client and the SDK's header codecs in two helpers
 * that match the call sites already used by our API routes:
 *
 *   const payment = await processPayment(req, config)
 *   if (!payment) return paymentRequired(config)
 *
 * The SDK speaks x402 v2 with CAIP-2 networks. EIP-3009 transferWithAuthorization
 * is used for USDT/USDG on X Layer (chain `eip155:196`).
 */

import { NextRequest, NextResponse } from "next/server"
import { OKXFacilitatorClient } from "@okxweb3/x402-core/facilitator"
import {
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
  decodePaymentSignatureHeader,
} from "@okxweb3/x402-core/http"
import type {
  PaymentRequired,
  PaymentRequirements,
  Network,
} from "@okxweb3/x402-core/types"

const NETWORK: Network = "eip155:196"
const X402_VERSION = 2

// ---------------------------------------------------------------------------
// Facilitator client (singleton)
// ---------------------------------------------------------------------------

let _facilitator: OKXFacilitatorClient | null = null

function getFacilitator(): OKXFacilitatorClient {
  if (_facilitator) return _facilitator

  const apiKey = process.env.OKX_API_KEY
  const secretKey = process.env.OKX_SECRET_KEY
  const passphrase = process.env.OKX_PASSPHRASE
  if (!apiKey || !secretKey || !passphrase) {
    throw new Error("OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE must be set")
  }

  _facilitator = new OKXFacilitatorClient({
    apiKey,
    secretKey,
    passphrase,
    syncSettle: true,
  })
  return _facilitator
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type PaymentConfig = {
  /** Amount in token smallest unit (6 decimals for USDT → "1000000" = 1 USDT) */
  amount: string
  /** Token contract address on X Layer */
  asset: string
  /** Recipient wallet address */
  payTo: string
  /** Human-readable description shown to the payer */
  description?: string
}

export type PaymentResult = {
  payer: string
  txHash: string
}

/** Build a `PaymentRequirements` object from our internal config. */
function buildRequirements(config: PaymentConfig): PaymentRequirements {
  return {
    scheme: "exact",
    network: NETWORK,
    asset: config.asset,
    amount: config.amount,
    payTo: config.payTo,
    maxTimeoutSeconds: 300,
    // EIP-712 domain hints + transfer method for USDT/USDG on X Layer.
    extra: {
      name: "USD₮0",
      version: "1",
      assetTransferMethod: "eip3009",
    },
  }
}

/**
 * Build a 402 Payment Required response with a `PAYMENT-REQUIRED` header.
 * The body still includes a JSON `{ error }` (legacy) plus any extra fields
 * provided in `extraBody` (used by the signals route to leak the count hint).
 */
export function paymentRequired(
  config: PaymentConfig,
  extraBody?: Record<string, unknown>,
): NextResponse {
  const requirements = buildRequirements(config)
  const paymentRequired: PaymentRequired = {
    x402Version: X402_VERSION,
    error: "Payment Required",
    resource: { description: config.description ?? "Ethy Arena payment", url: "" },
    accepts: [requirements],
  }

  return new NextResponse(
    JSON.stringify({ error: "Payment Required", ...(extraBody ?? {}) }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired),
      },
    },
  )
}

/**
 * End-to-end x402 payment processing: decode header, verify, settle.
 *
 * @returns PaymentResult on success, null if no PAYMENT-SIGNATURE header is present.
 * @throws  On invalid signature, balance, or failed settlement.
 */
export async function processPayment(
  req: NextRequest,
  config: PaymentConfig,
): Promise<PaymentResult | null> {
  const header =
    req.headers.get("PAYMENT-SIGNATURE") ??
    req.headers.get("payment-signature")
  if (!header) return null

  const paymentPayload = decodePaymentSignatureHeader(header)
  const requirements = buildRequirements(config)

  const facilitator = getFacilitator()

  const verification = await facilitator.verify(paymentPayload, requirements)
  if (!verification.isValid) {
    throw new Error(
      `Payment verification failed: ${verification.invalidReason ?? "unknown"}`,
    )
  }

  const settlement = await facilitator.settle(paymentPayload, requirements)
  if (!settlement.success) {
    throw new Error(
      `Payment settlement failed: ${settlement.errorReason ?? "unknown"}`,
    )
  }

  return {
    payer: settlement.payer ?? verification.payer ?? "",
    txHash: settlement.transaction,
  }
}

/** Attach the settlement tx hash as a `PAYMENT-RESPONSE` header on a success response. */
export function attachPaymentResponse(
  res: NextResponse,
  payment: PaymentResult,
): NextResponse {
  res.headers.set(
    "PAYMENT-RESPONSE",
    encodePaymentResponseHeader({
      success: true,
      status: "success",
      transaction: payment.txHash,
      network: NETWORK,
      payer: payment.payer,
    }),
  )
  return res
}
