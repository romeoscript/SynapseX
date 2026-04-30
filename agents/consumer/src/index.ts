/**
 * Ethy Consumer Agent
 *
 * Autonomous trading agent that:
 * 1. Polls the arena for new signals via x402 payment flow
 * 2. Evaluates signals (BUY only, confidence >= threshold)
 * 3. Executes DEX swaps via OKX Trade API on X Layer
 * 4. Monitors open positions for TP/SL
 */

import { ethers } from "ethers"
import { XLAYER_RPC, USDT_ADDRESS } from "@ethy-arena/shared"
import type { Signal, Position, PositionStatus } from "@ethy-arena/shared"
import { createWalletClient, http, publicActions } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { xLayer } from "viem/chains"
import { wrapFetchWithPayment, x402Client } from "@okxweb3/x402-fetch"
import { ExactEvmScheme } from "@okxweb3/x402-evm"
import { decodePaymentResponseHeader } from "@okxweb3/x402-core/http"
import { executeSwap, executeSellSwap, getCurrentPrice } from "./trader.js"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
// Use /data (Railway persistent volume) if available, otherwise local
const STATE_DIR = existsSync("/data") ? "/data" : join(__dirname, "..")
const STATE_FILE = join(STATE_DIR, ".consumer-state.json")

// --- Config ---

const ARENA_URL = process.env.ARENA_URL!
const PRIVATE_KEY = process.env.CONSUMER_PRIVATE_KEY!
const AGENT_ID = process.env.CONSUMER_AGENT_ID!
const MIN_CONFIDENCE = Number(process.env.CONSUMER_MIN_CONFIDENCE || "75")
// Base trade amount: 1 USDT (1000000 in 6 decimals), scaled by signal confidence
const BASE_TRADE_USDT = Number(process.env.CONSUMER_BASE_TRADE || "1")
const CHECK_INTERVAL = Number(process.env.CONSUMER_CHECK_INTERVAL || "60000")

// --- State (persisted to disk) ---

function loadLastSeenId(): string | undefined {
  try {
    if (existsSync(STATE_FILE)) {
      const state = JSON.parse(readFileSync(STATE_FILE, "utf-8"))
      return state.lastSeenId
    }
  } catch { /* ignore */ }
  return undefined
}

function saveLastSeenId(id: string) {
  writeFileSync(STATE_FILE, JSON.stringify({ lastSeenId: id }))
}

let lastSeenId = loadLastSeenId()
const positions: Position[] = []

// --- Helpers ---

function ts(): string {
  return new Date().toISOString().slice(11, 19)
}

// --- Position monitoring ---

async function checkPositions(wallet: ethers.Wallet) {
  const openPositions = positions.filter((p) => p.status === "open")
  if (openPositions.length === 0) return

  console.log(`[${ts()}] Checking ${openPositions.length} open position(s)...`)

  for (const pos of openPositions) {
    const price = await getCurrentPrice(pos.tokenAddress)
    if (price === null) {
      console.log(`  ${pos.token}: price unavailable, skipping`)
      continue
    }

    console.log(
      `  ${pos.token}: $${price.toFixed(4)} (market: $${pos.marketPrice}, TP: $${pos.takeProfit}, SL: $${pos.stopLoss})`,
    )

    let closeReason: PositionStatus | null = null

    if (price >= pos.takeProfit) {
      closeReason = "closed_tp"
      console.log(`  >>> TP HIT for ${pos.token}!`)
    } else if (price <= pos.stopLoss) {
      closeReason = "closed_sl"
      console.log(`  >>> SL HIT for ${pos.token}!`)
    }

    if (closeReason) {
      pos.status = closeReason
      pos.exitPrice = price
      pos.pnl = ((price - pos.marketPrice) / pos.marketPrice) * 100

      let exitTxHash: string | undefined

      // Only execute sell swap if we have tokens to sell
      if (pos.tokenAmount && pos.tokenAmount > 0) {
        const result = await executeSellSwap({
          tokenAddress: pos.tokenAddress,
          tokenAmount: String(pos.tokenAmount),
          wallet,
        })

        if (result) {
          pos.exitTxHash = result.txHash
          exitTxHash = result.txHash
          console.log(`  Closed ${pos.token}: PnL ${pos.pnl.toFixed(2)}% | TX: ${result.txHash}`)
        } else {
          console.log(`  Closed ${pos.token} (swap failed): PnL ${pos.pnl.toFixed(2)}%`)
        }
      } else {
        console.log(`  Closed ${pos.token} (no tokens to sell): PnL ${pos.pnl.toFixed(2)}%`)
      }

    }
  }
}

// --- Signal fetching and evaluation ---

type PaidFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

async function checkSignals(paidFetch: PaidFetch, wallet: ethers.Wallet) {
  console.log(`[${ts()}] Checking for new signals from "${AGENT_ID}"...`)

  const url = lastSeenId
    ? `${ARENA_URL}/api/signals/${AGENT_ID}?since=${lastSeenId}`
    : `${ARENA_URL}/api/signals/${AGENT_ID}`

  try {
    const res = await paidFetch(url)
    if (!res.ok) {
      throw new Error(`Arena ${res.status}: ${await res.text()}`)
    }
    const settleHeader = res.headers.get("PAYMENT-RESPONSE")
    const paymentTxHash = settleHeader
      ? decodePaymentResponseHeader(settleHeader).transaction
      : undefined
    const body = (await res.json()) as { newSignals?: number; signals?: Signal[] }

    if (body.newSignals === 0 || !body.signals?.length) {
      console.log("  No new signals")
      return
    }

    if (paymentTxHash) {
      console.log(`  Paid for signals (${paymentTxHash})`)
    }

    console.log(`  Received ${body.signals.length} signal(s)`)

    // Update last seen ID to the newest signal (persisted to disk)
    lastSeenId = body.signals[0].id
    saveLastSeenId(lastSeenId)

    for (const signal of body.signals) {
      console.log(
        `  Signal: ${signal.action} ${signal.token} @ $${signal.marketPrice} (conf: ${signal.confidence}%)`,
      )

      // Filter: BUY only, confidence >= threshold
      if (signal.action !== "BUY") {
        console.log(`  Skipping: SELL signals not supported for opening positions`)
        continue
      }
      if (signal.confidence < MIN_CONFIDENCE) {
        console.log(`  Skipping: confidence ${signal.confidence}% < ${MIN_CONFIDENCE}%`)
        continue
      }

      // Check we don't already have a position for this token
      const existing = positions.find(
        (p) => p.tokenAddress === signal.tokenAddress && p.status === "open",
      )
      if (existing) {
        console.log(`  Skipping: already have open position for ${signal.token}`)
        continue
      }

      // Trade amount = base * confidence/100 (e.g., 1 USDT * 85% = 0.85 USDT)
      const tradeUsdt = BASE_TRADE_USDT * (signal.confidence / 100)
      const tradeAmount = Math.round(tradeUsdt * 1e6).toString() // 6 decimals

      // Execute BUY swap: USDT -> token
      console.log(`  Executing swap: ${tradeUsdt.toFixed(2)} USDT -> ${signal.token} (conf: ${signal.confidence}%)`)
      const result = await executeSwap({
        fromToken: USDT_ADDRESS,
        toToken: signal.tokenAddress,
        amount: tradeAmount,
        wallet,
      })

      if (!result) {
        console.log(`  Swap failed for ${signal.token}, skipping`)
        continue
      }

      // Track the position
      const position: Position = {
        signalId: signal.id,
        token: signal.token,
        tokenAddress: signal.tokenAddress,
        marketPrice: signal.marketPrice,
        takeProfit: signal.takeProfit,
        stopLoss: signal.stopLoss,
        amount: tradeUsdt,
        tokenAmount: Number(result.toAmount),
        entryTxHash: result.txHash,
        status: "open",
      }
      positions.push(position)

      console.log(`  Position opened: ${signal.token} | TX: ${result.txHash}`)
    }
  } catch (err) {
    console.error(`  Error fetching signals:`, err instanceof Error ? err.message : err)
  }
}

// --- Main loop ---

async function tick(paidFetch: PaidFetch, wallet: ethers.Wallet) {
  // 1. Check open positions for TP/SL first
  await checkPositions(wallet)

  // 2. Check for new signals
  await checkSignals(paidFetch, wallet)

  // 3. Summary
  const open = positions.filter((p) => p.status === "open").length
  const closed = positions.filter((p) => p.status !== "open").length
  console.log(`[${ts()}] Positions: ${open} open, ${closed} closed\n`)
}

async function main() {
  console.log("=".repeat(45))
  console.log("  Ethy Consumer Agent")
  console.log(`  Arena:      ${ARENA_URL}`)
  console.log(`  Agent:      ${AGENT_ID}`)
  console.log(`  Min conf:   ${MIN_CONFIDENCE}%`)
  console.log(`  Base trade: ${BASE_TRADE_USDT} USDT * confidence%`)
  console.log(`  Interval:   ${CHECK_INTERVAL / 1000}s`)
  console.log("=".repeat(45))

  if (!ARENA_URL || !PRIVATE_KEY || !AGENT_ID) {
    console.error("\nError: ARENA_URL, CONSUMER_PRIVATE_KEY, and CONSUMER_AGENT_ID are required")
    process.exit(1)
  }

  const provider = new ethers.JsonRpcProvider(XLAYER_RPC)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

  // viem signer for x402 EIP-3009 authorization (separate from ethers wallet,
  // which still drives DEX swaps). Same private key, two different stacks.
  const account = privateKeyToAccount(
    (PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`) as `0x${string}`,
  )
  const viemWallet = createWalletClient({
    account,
    chain: xLayer,
    transport: http(XLAYER_RPC),
  }).extend(publicActions)

  const signer = {
    address: account.address,
    signTypedData: (msg: {
      domain: Record<string, unknown>
      types: Record<string, unknown>
      primaryType: string
      message: Record<string, unknown>
    }) =>
      viemWallet.signTypedData({
        account,
        domain: msg.domain as Parameters<typeof viemWallet.signTypedData>[0]["domain"],
        types: msg.types as Parameters<typeof viemWallet.signTypedData>[0]["types"],
        primaryType: msg.primaryType,
        message: msg.message,
      }),
  }

  const client = x402Client.fromConfig({
    schemes: [
      {
        network: "eip155:196",
        client: new ExactEvmScheme(signer),
        x402Version: 2,
      },
    ],
  })
  const paidFetch = wrapFetchWithPayment(globalThis.fetch, client)

  console.log(`  Wallet:     ${wallet.address}\n`)

  await tick(paidFetch, wallet)
  setInterval(() => tick(paidFetch, wallet), CHECK_INTERVAL)
}

main().catch(console.error)
