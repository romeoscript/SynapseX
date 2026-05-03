/**
 * x402 payment middleware — Coinbase CDP facilitator.
 *
 * Replaces OKX facilitator with Coinbase's production x402 facilitator.
 * Works on Base with USDC. No custom on-chain code needed.
 *
 * Required env:
 *   CDP_API_KEY_NAME         — Coinbase CDP key name (e.g. "organizations/.../apiKeys/...")
 *   CDP_API_KEY_PRIVATE_KEY  — EC private key PEM from CDP dashboard
 */

import { NextRequest, NextResponse } from "next/server"
import { SignJWT, importPKCS8 } from "jose"
import { USDC_ADDRESS } from "@ethy-arena/shared"

const NETWORK = "eip155:8453"
const X402_VERSION = 2
const CDP_FACILITATOR = process.env.CDP_FACILITATOR_URL ?? "https://api.cdp.coinbase.com/platform/v2/x402"

export type PaymentConfig = {
  amount: string
  asset: string
  payTo: string
  description?: string
}

export type PaymentResult = {
  payer: string
  txHash: string
}

// ── Coinbase CDP JWT Auth ─────────────────────────────────────────────────

async function getCDPToken(): Promise<string> {
  const keyName = process.env.CDP_API_KEY_NAME
  const rawKey = process.env.CDP_API_KEY_PRIVATE_KEY
  if (!keyName || !rawKey) throw new Error("CDP_API_KEY_NAME / CDP_API_KEY_PRIVATE_KEY not set")

  const pem = rawKey.replace(/\\n/g, "\n")
  const privateKey = await importPKCS8(pem, "ES256")

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyName })
    .setIssuedAt()
    .setExpirationTime("2min")
    .setSubject(keyName)
    .sign(privateKey)
}

async function cdpPost<T>(endpoint: string, body: unknown): Promise<T> {
  const token = await getCDPToken()
  const res = await fetch(`${CDP_FACILITATOR}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`CDP facilitator ${endpoint} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Payment helpers ───────────────────────────────────────────────────────

function buildRequirements(config: PaymentConfig) {
  return {
    scheme: "exact",
    network: NETWORK,
    asset: config.asset,
    amount: config.amount,
    payTo: config.payTo,
    maxTimeoutSeconds: 300,
    extra: { name: "USD Coin", version: "2", assetTransferMethod: "eip3009" },
  }
}

export function paymentRequired(config: PaymentConfig, extraBody?: Record<string, unknown>): NextResponse {
  const body = {
    x402Version: X402_VERSION,
    error: "Payment Required",
    resource: { description: config.description ?? "SynapseX payment", url: "" },
    accepts: [buildRequirements(config)],
  }
  return new NextResponse(
    JSON.stringify({ error: "Payment Required", ...(extraBody ?? {}) }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(body)).toString("base64"),
      },
    },
  )
}

export async function processPayment(req: NextRequest, config: PaymentConfig): Promise<PaymentResult | null> {
  const header =
    req.headers.get("X-PAYMENT") ??
    req.headers.get("x-payment") ??
    req.headers.get("PAYMENT-SIGNATURE") ??
    req.headers.get("payment-signature")

  if (!header) return null

  let paymentPayload: unknown
  try {
    paymentPayload = JSON.parse(Buffer.from(header, "base64").toString())
  } catch {
    throw new Error("Invalid payment header — not valid base64 JSON")
  }

  const requirements = buildRequirements(config)

  // Verify with Coinbase facilitator
  const verification = await cdpPost<{ isValid: boolean; invalidReason?: string; payer?: string }>(
    "/verify",
    { payment: paymentPayload, paymentRequirements: requirements },
  )
  if (!verification.isValid) {
    throw new Error(`Payment verification failed: ${verification.invalidReason ?? "unknown"}`)
  }

  // Settle with Coinbase facilitator
  const settlement = await cdpPost<{ success: boolean; errorReason?: string; transaction?: string; payer?: string }>(
    "/settle",
    { payment: paymentPayload, paymentRequirements: requirements },
  )
  if (!settlement.success) {
    throw new Error(`Payment settlement failed: ${settlement.errorReason ?? "unknown"}`)
  }

  return {
    payer: settlement.payer ?? verification.payer ?? "",
    txHash: settlement.transaction ?? "",
  }
}

export function attachPaymentResponse(res: NextResponse, payment: PaymentResult): NextResponse {
  res.headers.set(
    "PAYMENT-RESPONSE",
    Buffer.from(JSON.stringify({
      success: true, status: "success",
      transaction: payment.txHash, network: NETWORK, payer: payment.payer,
    })).toString("base64"),
  )
  return res
}
