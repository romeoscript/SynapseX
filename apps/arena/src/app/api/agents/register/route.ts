/**
 * POST /api/agents/register — Register a new agent on the Arena.
 *
 * x402-gated: requires a 5 USDT payment via X-PAYMENT header.
 * Returns the agent ID and a secret API key for publishing signals.
 */

import { paymentRequired, processPayment, attachPaymentResponse } from "@/lib/x402"
import { getDB } from "@/db"
import { agents, activity } from "@/db/schema"
import { eq } from "drizzle-orm"
import { USDT_ADDRESS } from "@ethy-arena/shared"
import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"

const REGISTRATION_FEE = "5000000" // 5 USDT (6 decimals)

const paymentConfig = {
  amount: REGISTRATION_FEE,
  asset: USDT_ADDRESS,
  payTo: process.env.ARENA_WALLET_ADDRESS!,
  description: "Agent registration fee",
}

export async function POST(req: NextRequest) {
  // Parse and validate body BEFORE payment (so we don't charge for invalid requests)
  const body = await req.json()
  const { name, description, pricePerQuery } = body

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 },
    )
  }

  if (typeof pricePerQuery !== "number" || pricePerQuery <= 0) {
    return NextResponse.json(
      { error: "pricePerQuery must be a positive number" },
      { status: 400 },
    )
  }

  // Process x402 payment — payer wallet becomes the agent ID
  let payment: { payer: string; txHash: string }
  try {
    const result = await processPayment(req, paymentConfig)
    if (!result) return paymentRequired(paymentConfig)
    payment = result
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment failed" },
      { status: 400 },
    )
  }

  const db = getDB()
  const id = payment.payer.toLowerCase()

  // One wallet = one agent
  const [existing] = await db.select({ id: agents.id }).from(agents).where(eq(agents.id, id))
  if (existing) {
    return NextResponse.json(
      { error: "Agent already registered with this wallet" },
      { status: 409 },
    )
  }

  const apiKey = `ethy_pk_${randomBytes(24).toString("hex")}`

  await db.insert(agents).values({
    id,
    name: name.trim(),
    description: description || "",
    apiKey,
    pricePerQuery,
    createdAt: new Date().toISOString(),
    registrationTx: payment.txHash,
  })

  await db.insert(activity).values({
    type: "agent_registered",
    agentId: id,
    data: JSON.stringify({ name, wallet: id, pricePerQuery }),
    txHash: payment.txHash,
    createdAt: new Date().toISOString(),
  })

  return attachPaymentResponse(
    NextResponse.json({ agentId: id, apiKey }),
    payment,
  )
}
