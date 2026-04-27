import { okxFetch } from "./okx-client"
import { XLAYER_CHAIN_ID } from "@ethy-arena/shared"

type OKXResponse<T> = {
  code: string
  data: T
}

type RawCandle = [string, string, string, string, string, string, string, string]
// [timestamp, open, high, low, close, volume, volumeUsd, confirm]

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

function parseCandle(raw: RawCandle): Candle {
  return {
    timestamp: Number(raw[0]),
    open: Number(raw[1]),
    high: Number(raw[2]),
    low: Number(raw[3]),
    close: Number(raw[4]),
    volume: Number(raw[5]),
    volumeUsd: Number(raw[6]),
    confirmed: raw[7] === "1",
  }
}

/** Fetch candlestick data for a token on X Layer. */
export async function getCandles(
  tokenAddress: string,
  bar = "15m",
  limit = 100,
): Promise<Candle[]> {
  const path = `/api/v6/dex/market/candles?chainIndex=${XLAYER_CHAIN_ID}&tokenContractAddress=${tokenAddress}&bar=${bar}&limit=${limit}`
  const res = await okxFetch<OKXResponse<RawCandle[]>>("GET", path)
  if (res.code !== "0" || !res.data?.length) return []
  return res.data.map(parseCandle)
}

/** Get the current price (latest close) for a token on X Layer. */
export async function getCurrentPrice(tokenAddress: string): Promise<number | null> {
  const candles = await getCandles(tokenAddress, "1m", 1)
  if (candles.length === 0) return null
  return candles[0].close
}
