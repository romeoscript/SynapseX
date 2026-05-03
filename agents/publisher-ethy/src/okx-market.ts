/**
 * Market data via OnchainOS CLI (chain: "base").
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

export async function getCandles(tokenAddress: string, bar = "15m", limit = 100): Promise<Candle[]> {
  const result = await getMarketKline(tokenAddress, "base", bar, limit)
  if (!result.ok || !result.data) {
    console.error("  OnchainOS market kline error:", result.error)
    return []
  }
  if (!Array.isArray(result.data)) return []
  return result.data.map((c) => ({
    timestamp: Number(c.ts),
    open: Number(c.o),
    high: Number(c.h),
    low: Number(c.l),
    close: Number(c.c),
    volume: Number(c.vol),
  }))
}
