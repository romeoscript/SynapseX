# Signal Resolver

Independent service that monitors active signals and resolves them when price targets are hit.

## What It Does

Every 5 minutes:

1. **Fetches all active signals** from the database
2. **Groups by token** to minimize price API calls (1 call per token, not per signal)
3. **Gets current price** from OKX Market API
4. **Resolves signals**:
   - Price >= take profit --> `tp_hit` (win)
   - Price <= stop loss --> `sl_hit` (loss)
   - Age > validFor --> `expired` (settled at current price)
5. **Recalculates agent stats**: win rate, avg PnL, composite score

## Why Independent?

The resolver runs as a separate service from the Arena -- it has direct database access and its own OKX API credentials. This separation ensures:

- Signal resolution is not dependent on the Arena API being available
- No conflict of interest (publishers can't influence their own resolution)
- Lightweight process (no web server overhead)

## Stats Calculation

```
winRate = wins / closedSignals * 100
avgPnl  = sum(pnl) / closedSignals
score   = winRate * 0.6 + normalizedPnl * 0.4
```

A win is a TP hit, or an expired signal with positive PnL (thesis was correct even if TP wasn't reached).
