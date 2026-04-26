import { XLAYER_RPC } from "@ethy-arena/shared"

const MAX_TX_AGE_MS = 10 * 60 * 1000 // 10 minutes
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

type VerifyResult =
  | { valid: true; tokenAmount: number | null }
  | { valid: false; reason: string }

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(XLAYER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  const data = await res.json()
  return data.result
}

/**
 * Verify a trade TX hash on X Layer:
 * 1. TX exists on-chain
 * 2. TX sender matches the agent's wallet
 * 3. TX is recent (within MAX_TX_AGE_MS)
 * 4. TX involves a Transfer of the expected token (swap verification)
 */
export async function verifyTradeTx(
  txHash: string,
  agentWallet: string,
  tokenAddress?: string,
): Promise<VerifyResult> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { valid: false, reason: "Invalid TX hash format" }
  }

  try {
    // Fetch transaction
    const tx = await rpcCall("eth_getTransactionByHash", [txHash]) as Record<string, string> | null
    if (!tx) {
      return { valid: false, reason: "TX not found on X Layer" }
    }

    // Check sender matches agent wallet
    if (tx.from.toLowerCase() !== agentWallet.toLowerCase()) {
      return { valid: false, reason: "TX sender does not match agent wallet" }
    }

    // TX must be confirmed (has a block number)
    if (!tx.blockNumber) {
      return { valid: false, reason: "TX not yet confirmed" }
    }

    // Check TX is recent via block timestamp
    const block = await rpcCall("eth_getBlockByNumber", [tx.blockNumber, false]) as Record<string, string> | null
    if (block?.timestamp) {
      const blockTime = parseInt(block.timestamp, 16) * 1000
      const age = Date.now() - blockTime
      if (age > MAX_TX_AGE_MS) {
        return { valid: false, reason: `TX too old (${Math.round(age / 60000)}min ago, max ${MAX_TX_AGE_MS / 60000}min)` }
      }
    }

    // Verify TX involves a Transfer of the expected token + extract amount
    let tokenAmount: number | null = null

    if (tokenAddress) {
      const receipt = await rpcCall("eth_getTransactionReceipt", [txHash]) as {
        logs: Array<{ address: string; topics: string[]; data: string }>
      } | null

      if (!receipt) {
        return { valid: false, reason: "TX receipt not found" }
      }

      // Find Transfer logs for the expected token
      const tokenTransfers = receipt.logs.filter(
        (log) =>
          log.topics[0] === TRANSFER_TOPIC &&
          log.address.toLowerCase() === tokenAddress.toLowerCase(),
      )

      if (tokenTransfers.length === 0) {
        return { valid: false, reason: "TX does not involve the specified token" }
      }

      // Extract amount from the last Transfer event (swap output)
      const lastTransfer = tokenTransfers[tokenTransfers.length - 1]
      if (lastTransfer.data && lastTransfer.data !== "0x") {
        tokenAmount = Number(BigInt(lastTransfer.data))
      }
    }

    return { valid: true, tokenAmount }
  } catch (err) {
    return { valid: false, reason: `RPC error: ${err instanceof Error ? err.message : "unknown"}` }
  }
}
