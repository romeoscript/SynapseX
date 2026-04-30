export const XLAYER_CHAIN_ID = "196"
export const XLAYER_RPC = "https://rpc.xlayer.tech"

// Payment tokens
export const USDT_ADDRESS = "0x779ded0c9e1022225f8e0630b35a9b54be713736"

// Top tradeable tokens on X Layer (by liquidity)
export const XLAYER_TOKENS = [
  { symbol: "xETH", address: "0xe7b000003a45145decf8a28fc755ad5ec5ea025a", pair: "xETH/USDT", decimals: 18 },
  { symbol: "xBTC", address: "0xb7c00000bcdeef966b20b3d884b98e64d2b06b4f", pair: "xBTC/USDT", decimals: 8 },
  { symbol: "xSOL", address: "0x505000008de8748dbd4422ff4687a4fc9beba15b", pair: "xSOL/USDT", decimals: 9 },
  { symbol: "WOKB", address: "0xe538905cf8410324e03A5A23C1c177a474D59b2b", pair: "WOKB/USDT", decimals: 18 },
  { symbol: "XDOG", address: "0x0cc24c51bf89c00c5affbfcf5e856c25ecbdb48e", pair: "XDOG/USDT", decimals: 18 },
] as const
