/**
 * Market data via OnchainOS CLI.
 * Replaces custom OKX HMAC-SHA256 auth with `onchainos market kline`.
 */

import { getMarketKline } from "@ethy-arena/shared"

export type Candle = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** Fetch candlestick data for a token on X Layer via OnchainOS. */
export async function getCandles(
  tokenAddress: string,
  bar = "15m",
  limit = 100,
): Promise<Candle[]> {
  const result = await getMarketKline(tokenAddress, "xlayer", bar, limit)

  if (!result.ok || !result.data) {
    console.error("  OnchainOS market kline error:", result.error)
    return []
  }

  const data = result.data
  if (!Array.isArray(data)) return []

  return data.map((c) => ({
    timestamp: Number(c.ts),
    open: Number(c.o),
    high: Number(c.h),
    low: Number(c.l),
    close: Number(c.c),
    volume: Number(c.vol),
  }))
}
