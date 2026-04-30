/**
 * Ethy Publisher Agent
 *
 * Autonomous signal publisher for the Ethy Arena.
 * 1. Self-registers on the Arena (saves API key to disk)
 * 2. Fetches 15-minute candles, calculates RSI/ATR/volume
 * 3. Executes a real swap on X Layer via OnchainOS
 * 4. Publishes the signal with the trade TX hash as proof
 *
 * Usage: pnpm publisher (15min intervals)
 */

import { XLAYER_TOKENS, XLAYER_RPC } from "@ethy-arena/shared"
import {
  loadPublisherState,
  registerPublisher,
  executePublisherSwap,
  publishSignal,
  round,
  type PublisherState,
} from "@ethy-arena/shared/publisher"
import { getCandles } from "./okx-market.js"
import { rsi, atr, volumeChange } from "./indicators.js"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { ethers } from "ethers"

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATE_FILE = join(__dirname, "..", ".publisher-state.json")

const ARENA_URL = process.env.ARENA_URL!
const WALLET_ADDR = process.env.PUBLISHER_WALLET!
const PRIVATE_KEY = process.env.PUBLISHER_PRIVATE_KEY!
const INTERVAL = 15 * 60_000
const SWAP_AMOUNT = process.env.SWAP_AMOUNT || "1000000"

const provider = new ethers.JsonRpcProvider(XLAYER_RPC)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

// --- Analysis ---

function buildSignal(
  token: (typeof XLAYER_TOKENS)[number],
  action: "BUY" | "SELL",
  price: number,
  atrVal: number,
  rsiVal: number,
  volChange: number,
  tradeTxHash: string,
) {
  const conf = Math.max(
    0,
    Math.min(
      95,
      Math.floor(
        action === "BUY"
          ? 70 + (35 - rsiVal) + volChange / 20
          : 65 + (rsiVal - 65) + Math.abs(volChange) / 10,
      ),
    ),
  )

  const regime =
    rsiVal < 30 ? "oversold" :
    rsiVal < 45 ? "accumulation" :
    rsiVal > 70 ? "overbought" :
    rsiVal > 55 ? "distribution" : "neutral"

  return {
    token: token.symbol,
    tokenAddress: token.address,
    pair: token.pair,
    action,
    tradeTxHash,
    takeProfit: round(action === "BUY" ? price + atrVal * 2 : price - atrVal * 2),
    stopLoss: round(action === "BUY" ? price - atrVal : price + atrVal),
    confidence: conf,
    validFor: "7d",
    indicators: { rsi: round(rsiVal), atr: round(atrVal), volumeChange: round(volChange), regime },
    reasoning: `RSI ${action === "BUY" ? "oversold" : "overbought"} at ${round(rsiVal)}, ATR ${round(atrVal)}, volume ${volChange > 0 ? "+" : ""}${round(volChange)}%. Market regime: ${regime}.`,
  }
}

async function analyzeAndPublish(
  apiKey: string,
  token: (typeof XLAYER_TOKENS)[number],
) {
  const candles = await getCandles(token.address, "15m", 100)
  if (candles.length < 20) {
    console.log(`  ${token.symbol}: insufficient data (${candles.length} candles)`)
    return
  }

  const closes = candles.map((c) => c.close)
  const volumes = candles.map((c) => c.volume)
  const currentPrice = closes[closes.length - 1]

  const rsiVal = rsi(closes)
  const atrVal = atr(candles)
  const volChange = volumeChange(volumes)

  console.log(
    `  ${token.symbol}: $${round(currentPrice)} RSI=${round(rsiVal)} vol=${round(volChange)}% ATR=${round(atrVal)}`,
  )

  let action: "BUY" | "SELL" | null = null
  if (rsiVal < 35 && volChange > 50) action = "BUY"
  else if (rsiVal > 65 && volChange < -20) action = "SELL"

  if (!action) return

  const txHash = await executePublisherSwap({
    tokenAddress: token.address,
    action,
    swapAmount: SWAP_AMOUNT,
    wallet,
  })
  if (!txHash) {
    console.log(`  Skipping ${token.symbol} — swap failed`)
    return
  }

  const signal = buildSignal(token, action, currentPrice, atrVal, rsiVal, volChange, txHash)
  await publishSignal(ARENA_URL, apiKey, signal)
}

// --- Main ---

async function main() {
  console.log("═══════════════════════════════════════")
  console.log("  Ethy Publisher Agent")
  console.log(`  Interval: ${INTERVAL / 1000}s`)
  console.log(`  Arena: ${ARENA_URL}`)
  console.log(`  Wallet: ${WALLET_ADDR}`)
  console.log(`  Tokens: ${XLAYER_TOKENS.map((t) => t.symbol).join(", ")}`)
  console.log("═══════════════════════════════════════\n")

  if (!ARENA_URL || !WALLET_ADDR || !PRIVATE_KEY) {
    console.error("Error: ARENA_URL, PUBLISHER_WALLET, and PUBLISHER_PRIVATE_KEY are required")
    process.exit(1)
  }

  let state: PublisherState | null = loadPublisherState(STATE_FILE, WALLET_ADDR)
  if (!state) {
    state = await registerPublisher({
      name: "Ethy AI",
      description: "Autonomous signal publisher — RSI/ATR/volume analysis on X Layer tokens",
      pricePerQuery: 0.1,
      arenaUrl: ARENA_URL,
      wallet,
      stateFile: STATE_FILE,
    })
  }
  console.log(`Agent: ${state.agentId}`)
  console.log(`API Key: ${state.apiKey.slice(0, 12)}...`)

  const tick = async () => {
    const now = new Date().toISOString().slice(11, 19)
    console.log(`\n[${now}] Analyzing...`)

    for (const token of XLAYER_TOKENS) {
      await analyzeAndPublish(state!.apiKey, token)
    }
  }

  await tick()
  setInterval(tick, INTERVAL)
}

main().catch(console.error)
