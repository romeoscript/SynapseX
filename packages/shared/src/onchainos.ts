/**
 * OnchainOS CLI wrapper — calls `onchainos` CLI for DeFi operations.
 * Replaces custom OKX HMAC auth with OKX's official tool.
 *
 * The CLI handles auth, clock sync, and API details internally.
 */

import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

const ONCHAINOS_BIN = process.env.ONCHAINOS_BIN || "onchainos"

export type OnchainOSResult<T = unknown> = {
  ok: boolean
  data?: T
  error?: string
}

/** Run an onchainos CLI command and parse JSON output. */
export async function onchainos<T = unknown>(
  subcommand: string,
  args: Record<string, string | number | boolean | undefined> = {},
): Promise<OnchainOSResult<T>> {
  const execArgs = [...subcommand.split(" ")]

  for (const [key, val] of Object.entries(args)) {
    if (val === undefined || val === false) continue
    const flag = `--${key.replace(/_/g, "-")}`
    execArgs.push(flag)
    if (val !== true) execArgs.push(String(val))
  }

  try {
    const { stdout: raw } = await execFileAsync(ONCHAINOS_BIN, execArgs, {
      encoding: "utf-8",
      timeout: 30_000,
      env: { ...process.env, NO_COLOR: "1" },
    })
    const stdout = raw.trim()

    if (!stdout) return { ok: true }

    const parsed = JSON.parse(stdout)
    // onchainos returns { ok: true/false, data: ... } or { ok: false, error: ... }
    if ("ok" in parsed) return parsed as OnchainOSResult<T>
    // Some commands return raw data
    return { ok: true, data: parsed }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── Market data ──

export type KlineBar = {
  ts: string
  o: string
  h: string
  l: string
  c: string
  vol: string
  volUsd: string
  confirm: string
}

export async function getMarketKline(
  tokenAddress: string,
  chain = "xlayer",
  bar = "15m",
  limit = 100,
) {
  return onchainos<KlineBar[]>("market kline", {
    address: tokenAddress,
    chain,
    bar,
    limit,
  })
}

export async function getMarketPrice(tokenAddress: string, chain = "xlayer") {
  return onchainos<Array<{ price: string; tokenContractAddress: string }>>("market price", {
    address: tokenAddress,
    chain,
  })
}

// ── Swap ──

export type SwapQuoteResult = {
  toTokenAmount: string
  estimateGasFee: string
  fromTokenAmount: string
  [key: string]: unknown
}

export async function swapQuote(params: {
  from: string
  to: string
  amount: string
  chain?: string
}) {
  return onchainos<SwapQuoteResult[]>("swap quote", {
    from: params.from,
    to: params.to,
    amount: params.amount,
    chain: params.chain || "xlayer",
  })
}

export type SwapTxResult = {
  tx: { to: string; data: string; value: string; gasLimit: string }
  toTokenAmount: string
  [key: string]: unknown
}

export async function swapExecute(params: {
  from: string
  to: string
  amount: string
  wallet: string
  chain?: string
  slippage?: string
}) {
  return onchainos<SwapTxResult[]>("swap swap", {
    from: params.from,
    to: params.to,
    amount: params.amount,
    wallet: params.wallet,
    chain: params.chain || "xlayer",
    slippage: params.slippage,
  })
}

// ── Portfolio ──

export type TokenBalance = {
  symbol: string
  balance: string
  tokenAddress: string
  usdValue: string
  [key: string]: unknown
}

export async function getPortfolioBalances(address: string, chains = "xlayer") {
  return onchainos<{ details: Array<{ tokenAssets: TokenBalance[] }> }>(
    "portfolio all-balances",
    { address, chains },
  )
}

export async function getPortfolioTotalValue(address: string, chains = "xlayer") {
  return onchainos<{ totalValueUsd: string }>(
    "portfolio total-value",
    { address, chains },
  )
}

// ── Token info ──

export async function getTokenInfo(address: string, chain = "xlayer") {
  return onchainos("token info", { address, chain })
}

export async function searchToken(query: string, chains = "xlayer") {
  return onchainos("token search", { query, chains })
}
