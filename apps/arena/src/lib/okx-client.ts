/**
 * OKX API client with HMAC-SHA256 authentication.
 *
 * Centralised HTTP helper for all OKX endpoints:
 *   - x402 facilitator  (verify / settle)
 *   - Market Data API   (candles, tickers)
 *   - Trade API         (DEX swaps)
 *
 * Every request is signed per OKX's auth spec:
 *   OK-ACCESS-SIGN = base64(HMAC-SHA256(secret, timestamp + METHOD + path + body))
 *
 * Clock sync is critical — OKX rejects requests when the local clock drifts
 * more than ~5 s from their servers. We fetch their server time once on first
 * use and re-sync every 30 s.
 */

import { createHmac } from "crypto"

const OKX_BASE_URL = "https://web3.okx.com"

// --- Clock Sync ---

let timeOffset = 0
let synced = false

/**
 * Fetch OKX server time and compute offset from local clock.
 * Accounts for network latency by halving the round-trip time.
 */
export async function syncTime(): Promise<void> {
  try {
    const before = Date.now()
    const res = await fetch("https://www.okx.com/api/v5/public/time")
    const data = (await res.json()) as { data: Array<{ ts: string }> }
    const serverTime = Number(data.data[0].ts)
    const latency = (Date.now() - before) / 2
    timeOffset = serverTime - Date.now() + latency
  } catch (err) {
    console.warn("[okx-client] Clock sync failed, using local time:", err)
  }
}

/** Ensure clock is synced before the first request. Re-syncs every 30 s. */
async function ensureSynced(): Promise<void> {
  if (!synced) {
    await syncTime()
    synced = true
    setInterval(syncTime, 30_000)
  }
}

// --- HMAC Signing ---

function getTimestamp(): string {
  return new Date(Date.now() + timeOffset).toISOString()
}

function sign(
  timestamp: string,
  method: string,
  path: string,
  body: string,
): string {
  const secret = process.env.OKX_SECRET_KEY
  if (!secret) throw new Error("OKX_SECRET_KEY is not set")

  const prehash = timestamp + method + path + body
  return createHmac("sha256", secret).update(prehash).digest("base64")
}

// --- Public API ---

/**
 * Authenticated fetch against the OKX Web3 API.
 *
 * @param method  HTTP method (GET or POST)
 * @param path    API path, e.g. "/api/v6/x402/verify"
 * @param body    Request body (POST only, will be JSON-serialised)
 * @returns       Parsed JSON response
 */
export async function okxFetch<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  await ensureSynced()

  const timestamp = getTimestamp()
  const bodyStr = body ? JSON.stringify(body) : ""

  const apiKey = process.env.OKX_API_KEY
  const passphrase = process.env.OKX_PASSPHRASE
  if (!apiKey) throw new Error("OKX_API_KEY is not set")
  if (!passphrase) throw new Error("OKX_PASSPHRASE is not set")

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-SIGN": sign(timestamp, method, path, bodyStr),
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": passphrase,
  }

  // Project ID is required for Web3 endpoints
  if (process.env.OKX_PROJECT_ID) {
    headers["OK-ACCESS-PROJECT"] = process.env.OKX_PROJECT_ID
  }

  const res = await fetch(`${OKX_BASE_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: bodyStr } : {}),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OKX API ${method} ${path} → ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}
