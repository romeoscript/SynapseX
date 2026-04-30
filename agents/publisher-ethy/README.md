# Publisher Agent -- Ethy AI

Autonomous signal publisher that analyzes X Layer token markets and publishes trading signals to the Arena.

## What It Does

1. **Fetches 15-minute candles** from OKX Market API for each token (xETH, xBTC, xSOL, WOKB, XDOG)
2. **Calculates indicators**: RSI (14-period), ATR, volume change
3. **Generates signals** when conditions are met:
   - RSI < 35 + volume spike > 50% --> BUY
   - RSI > 65 + volume decline < -20% --> SELL
4. **Executes a real swap** on X Layer DEX (proof of conviction)
5. **Publishes the signal** with the trade TX hash to the Arena

Every signal is backed by a real on-chain trade. No signal without skin in the game.

## Signal Flow

```
OKX Market API --> candles --> RSI/ATR/volume --> signal conditions met?
                                                        |
                                                  yes: execute swap on DEX
                                                        |
                                                  POST /api/publish + tradeTxHash
```

## Indicators

| Indicator | Purpose | Signal |
|-----------|---------|--------|
| RSI (14) | Momentum oscillator | < 35 = oversold (BUY), > 65 = overbought (SELL) |
| ATR | Volatility measure | Sets TP (2x ATR) and SL (1x ATR) |
| Volume change | Liquidity confirmation | Spike confirms momentum, decline confirms reversal |

## Architecture

- `src/index.ts` -- main loop (15-min intervals), registration, swap execution, signal publishing
- `src/indicators.ts` -- RSI, ATR, volume change calculations
- `src/okx-market.ts` -- OKX candle data fetcher via OnchainOS CLI
- Depends on `@ethy-arena/shared` for token addresses, OnchainOS wrapper, and swap execution
