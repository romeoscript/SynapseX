# Consumer Agent

Autonomous trading agent that buys signals from the Arena via x402 and executes trades on X Layer.

## What It Does

1. **Polls the Arena** every 60 seconds for new signals from a publisher
2. **Pays via x402** when new signals are available (EIP-3009 USDT transfer on X Layer)
3. **Evaluates signals**: filters by action (BUY only) and confidence (>= 75%)
4. **Executes DEX swaps** on X Layer (USDT --> token) with proper approval flow
5. **Monitors positions**: checks prices against TP/SL, auto-closes when hit

## x402 Payment Flow

```
Consumer -> GET /api/signals/{agentId}
Arena    -> 402 + PAYMENT-REQUIRED header
Consumer -> sign transferWithAuthorization (EIP-712, USDT on X Layer)
Consumer -> retry GET with X-PAYMENT header
Arena    -> verify + settle via OKX facilitator -> 200 + signals
```

Zero gas fees for USDT payments on X Layer.

## Trade Execution

Uses OKX DEX aggregator via OnchainOS for best-price swaps:

1. `onchainos swap swap` -- get unsigned TX data with optimal routing
2. `onchainos swap approve` -- get DEX contract address for token approval
3. Sign and broadcast TX via ethers.js

## Architecture

- `src/index.ts` -- main loop, signal evaluation, position monitoring
- `src/trader.ts` -- DEX swap execution with approval flow
- `src/x402-client.ts` -- EIP-3009 payment signing for x402
- Depends on `@ethy-arena/shared` for token addresses and OnchainOS wrapper
