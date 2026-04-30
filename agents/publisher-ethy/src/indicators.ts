/**
 * Technical analysis indicators powered by trading-signals library.
 * All functions are pure — no side effects, no API calls.
 */

import { RSI, ATR, SMA } from "trading-signals"

/** Relative Strength Index (default period: 14). Returns 0–100. */
export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  const indicator = new RSI(period)
  for (const c of closes) indicator.add(c)
  return Number(indicator.getResult())
}

/** Average True Range — measures volatility over `period` candles. */
export function atr(
  candles: { high: number; low: number; close: number }[],
  period = 14,
): number {
  if (candles.length < period + 1) return 0
  const indicator = new ATR(period)
  for (const c of candles) {
    indicator.add({ high: c.high, low: c.low, close: c.close })
  }
  return Number(indicator.getResult())
}

/** Volume change % compared to average of previous `lookback` candles. */
export function volumeChange(volumes: number[], lookback = 4): number {
  if (volumes.length < lookback + 1) return 0
  const latest = volumes[volumes.length - 1]
  const avg = new SMA(lookback)
  for (const v of volumes.slice(-lookback - 1, -1)) avg.add(v)
  const avgVal = Number(avg.getResult())
  if (avgVal === 0) return 0
  return ((latest - avgVal) / avgVal) * 100
}
