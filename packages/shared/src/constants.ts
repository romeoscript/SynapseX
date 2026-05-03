export const BASE_CHAIN_ID = "8453"
export const BASE_RPC = "https://mainnet.base.org"

// Payment token — USDC on Base (supports EIP-3009 transferWithAuthorization)
export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

// Uniswap V3 SwapRouter02 on Base
export const UNISWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481"

// Tradeable tokens on Base with Binance symbol for price feeds
export const BASE_TOKENS = [
  {
    symbol: "WETH",
    address: "0x4200000000000000000000000000000000000006",
    pair: "ETH/USDC",
    decimals: 18,
    binanceSymbol: "ETHUSDT",
    uniswapFee: 500,
  },
  {
    symbol: "cbBTC",
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    pair: "BTC/USDC",
    decimals: 8,
    binanceSymbol: "BTCUSDT",
    uniswapFee: 3000,
  },
  {
    symbol: "AERO",
    address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    pair: "AERO/USDC",
    decimals: 18,
    binanceSymbol: "AEROUSDT",
    uniswapFee: 3000,
  },
] as const

// Legacy aliases so existing imports don't break
export const XLAYER_CHAIN_ID = BASE_CHAIN_ID
export const XLAYER_RPC = BASE_RPC
export const USDT_ADDRESS = USDC_ADDRESS
export const XLAYER_TOKENS = BASE_TOKENS
