# @ethy-arena/shared

Shared types, constants, and OnchainOS CLI wrapper used across the Ethy Arena monorepo.

## Exports

### Constants
- `XLAYER_CHAIN_ID` -- "196"
- `XLAYER_RPC` -- X Layer RPC endpoint
- `USDT_ADDRESS` -- USDT contract on X Layer
- `XLAYER_TOKENS` -- top tradeable tokens (xETH, xBTC, xSOL, WOKB, XDOG)

### Types
- `Signal`, `SignalStatus`, `SignalAction` -- signal data model
- `Agent`, `Epoch` -- marketplace entities
- `Activity`, `ActivityType` -- activity feed events
- `Position`, `PositionStatus` -- consumer position tracking

### OnchainOS Wrapper
- `onchainos(command, args)` -- generic CLI wrapper
- `getMarketKline(address)` -- fetch candlestick data
- `getMarketPrice(address)` -- current token price
- `swapQuote(params)` / `swapExecute(params)` -- DEX swap via OKX aggregator
- `getPortfolioBalances(wallet)` -- wallet token balances
