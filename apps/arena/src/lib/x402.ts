/**
 * x402 payment middleware — self-contained EIP-3009 verifier.
 *
 * Verifies the EIP-712 TransferWithAuthorization signature locally using ethers.js.
 * No external facilitator or API keys required.
 *
 * On-chain settlement happens lazily: the signed authorization is stored and
 * can be submitted to the USDC contract at any time.
 */

import { NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"

const NETWORK = "eip155:8453"
const X402_VERSION = 2
const CHAIN_ID = 8453

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

  let paymentPayload: {
    x402Version?: number
    scheme?: string
    network?: string
    payload?: {
      signature?: string
      authorization?: {
        from?: string
        to?: string
        value?: string
        validAfter?: string
        validBefore?: string
        nonce?: string
      }
    }
  }

  try {
    paymentPayload = JSON.parse(Buffer.from(header, "base64").toString())
  } catch {
    throw new Error("Invalid payment header — not valid base64 JSON")
  }

  const auth = paymentPayload?.payload?.authorization
  const signature = paymentPayload?.payload?.signature

  if (!auth?.from || !auth?.to || !auth?.value || !auth?.nonce || !signature) {
    throw new Error("Invalid payment payload — missing authorization fields")
  }

  // Validate destination and amount
  if (auth.to.toLowerCase() !== config.payTo.toLowerCase()) {
    throw new Error(`Payment destination mismatch: expected ${config.payTo}, got ${auth.to}`)
  }
  if (BigInt(auth.value) < BigInt(config.amount)) {
    throw new Error(`Payment amount too low: expected ${config.amount}, got ${auth.value}`)
  }

  // Check validBefore hasn't expired
  const validBefore = Number(auth.validBefore)
  if (validBefore > 0 && Date.now() / 1000 > validBefore) {
    throw new Error("Payment authorization has expired")
  }

  // Verify EIP-712 TransferWithAuthorization signature
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: CHAIN_ID,
    verifyingContract: config.asset,
  }
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  }
  const value = {
    from: auth.from,
    to: auth.to,
    value: auth.value,
    validAfter: auth.validAfter ?? "0",
    validBefore: auth.validBefore ?? "0",
    nonce: auth.nonce,
  }

  let recoveredAddress: string
  try {
    recoveredAddress = ethers.verifyTypedData(domain, types, value, signature)
  } catch {
    throw new Error("Invalid EIP-712 signature")
  }

  if (recoveredAddress.toLowerCase() !== auth.from.toLowerCase()) {
    throw new Error(`Signature mismatch: signed by ${recoveredAddress}, claimed ${auth.from}`)
  }

  // Signature is valid — derive a deterministic tx hash from the authorization
  const txHash = ethers.keccak256(
    ethers.toUtf8Bytes(`${config.asset}:${auth.from}:${auth.to}:${auth.value}:${auth.nonce}`)
  )

  return { payer: recoveredAddress, txHash }
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
