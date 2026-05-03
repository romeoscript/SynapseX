/**
 * Market data via Binance public API (no auth) + CoinGecko fallback.
 * No API key required.
 */

const BINANCE_BASE = "https://api.binance.com/api/v3"

const ADDRESS_TO_BINANCE: Record<string, string> = {
  "0x4200000000000000000000000000000000000006": "ETHUSDT",
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "BTCUSDT",
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631": "AEROUSDT",
}

export type Candle = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  volumeUsd: number
  confirmed: boolean
}

async function coingeckoPrice(tokenAddress: string): Promise<number | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${tokenAddress}&vs_currencies=usd`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json() as Record<string, { usd: number }>
    return data[tokenAddress.toLowerCase()]?.usd ?? null
  } catch {
    return null
  }
}

export async function getCandles(tokenAddress: string, bar = "15m", limit = 100): Promise<Candle[]> {
  const symbol = ADDRESS_TO_BINANCE[tokenAddress.toLowerCase()]
  if (!symbol) return []
  const intervalMap: Record<string, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d" }
  const interval = intervalMap[bar] ?? "15m"
  try {
    const res = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
    if (!res.ok) return []
    const data = await res.json() as [number, string, string, string, string, string][]
    return data.map((c) => ({
      timestamp: c[0],
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
      volumeUsd: 0,
      confirmed: true,
    }))
  } catch {
    return []
  }
}

export async function getCurrentPrice(tokenAddress: string): Promise<number | null> {
  const symbol = ADDRESS_TO_BINANCE[tokenAddress.toLowerCase()]
  if (symbol) {
    try {
      const res = await fetch(`${BINANCE_BASE}/ticker/price?symbol=${symbol}`)
      if (res.ok) {
        const data = await res.json() as { price: string }
        return Number(data.price)
      }
    } catch { /* fall through to CoinGecko */ }
  }
  return coingeckoPrice(tokenAddress)
}
