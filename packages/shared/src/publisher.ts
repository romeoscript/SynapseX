/**
 * Shared publisher agent utilities.
 * Swaps via OnchainOS CLI (chain: "base"). x402 signing for USDC on Base.
 */

import { ethers } from "ethers"
import { USDC_ADDRESS } from "./constants.js"
import { swapExecute, onchainos } from "./onchainos.js"
import { readFileSync, writeFileSync, existsSync } from "fs"

const ERC20_ABI = [
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]

export type PublisherState = {
  agentId: string
  apiKey: string
  registeredAt: string
}

export function loadPublisherState(stateFile: string, wallet: string): PublisherState | null {
  if (process.env.PUBLISHER_API_KEY) {
    return { agentId: wallet.toLowerCase(), apiKey: process.env.PUBLISHER_API_KEY, registeredAt: "env" }
  }
  if (!existsSync(stateFile)) return null
  try { return JSON.parse(readFileSync(stateFile, "utf-8")) } catch { return null }
}

export function savePublisherState(stateFile: string, state: PublisherState) {
  writeFileSync(stateFile, JSON.stringify(state, null, 2))
  console.log(`  State saved to ${stateFile}`)
}

// EIP-3009 signing for USDC on Base
export async function signX402Payment(
  wallet: ethers.Wallet,
  accept: { maxAmountRequired: string; asset: string; payTo: string; chainIndex: string },
) {
  const nonce = ethers.hexlify(ethers.randomBytes(32))
  const validBefore = String(Math.floor(Date.now() / 1000) + 300)

  const signature = await wallet.signTypedData(
    { name: "USD Coin", version: "2", chainId: Number(accept.chainIndex), verifyingContract: accept.asset },
    {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    { from: wallet.address, to: accept.payTo, value: accept.maxAmountRequired, validAfter: "0", validBefore, nonce },
  )

  return {
    x402Version: 2,
    scheme: "exact",
    network: `eip155:${accept.chainIndex}`,
    payload: {
      signature,
      authorization: {
        from: wallet.address,
        to: accept.payTo,
        value: accept.maxAmountRequired,
        validAfter: "0",
        validBefore,
        nonce,
      },
    },
  }
}

export async function registerPublisher(config: {
  name: string
  description: string
  pricePerQuery: number
  arenaUrl: string
  wallet: ethers.Wallet
  stateFile: string
}): Promise<PublisherState> {
  console.log("\n--- Self-Registration ---")
  console.log(`  Registering ${config.wallet.address} on SynapseX...`)

  const body = { name: config.name, description: config.description, pricePerQuery: config.pricePerQuery }

  const res402 = await fetch(`${config.arenaUrl}/api/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (res402.status === 409) { console.log("  Already registered. Set PUBLISHER_API_KEY."); process.exit(1) }
  if (res402.status !== 402) throw new Error(`Expected 402, got ${res402.status}: ${await res402.text()}`)

  const payReqHeader = res402.headers.get("PAYMENT-REQUIRED")
  if (!payReqHeader) throw new Error("No PAYMENT-REQUIRED header")
  const payReq = JSON.parse(Buffer.from(payReqHeader, "base64").toString())
  const accept = payReq.accepts[0]
  console.log(`  Payment required: ${accept.amount} USDC`)

  const paymentPayload = await signX402Payment(config.wallet, {
    maxAmountRequired: accept.amount,
    asset: accept.asset,
    payTo: accept.payTo,
    chainIndex: accept.network?.replace("eip155:", "") ?? "8453",
  })

  const res = await fetch(`${config.arenaUrl}/api/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PAYMENT": Buffer.from(JSON.stringify(paymentPayload)).toString("base64") },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Registration failed: ${JSON.stringify(await res.json())}`)

  const { agentId, apiKey } = await res.json() as { agentId: string; apiKey: string }
  console.log(`  Registered! Agent ID: ${agentId}`)

  const state: PublisherState = { agentId, apiKey, registeredAt: new Date().toISOString() }
  savePublisherState(config.stateFile, state)
  return state
}

export async function executePublisherSwap(config: {
  tokenAddress: string
  action: "BUY" | "SELL"
  swapAmount: string
  wallet: ethers.Wallet
}): Promise<string | null> {
  console.log(`  Executing ${config.action} swap on Base via OnchainOS...`)

  const from = config.action === "BUY" ? USDC_ADDRESS : config.tokenAddress
  const to = config.action === "BUY" ? config.tokenAddress : USDC_ADDRESS

  const result = await swapExecute({
    from, to,
    amount: config.swapAmount,
    wallet: config.wallet.address,
    chain: "base",
    slippage: "1",
  })

  if (!result.ok || !result.data) {
    console.error(`  Swap quote failed: ${result.error}`)
    return null
  }

  const swapData = Array.isArray(result.data) ? result.data[0] : result.data
  const txData = (swapData as Record<string, unknown>).tx as {
    to: string; data: string; value: string; gas?: string; gasLimit?: string; gasPrice?: string
  } | undefined

  if (!txData) { console.error("  No TX data in swap response"); return null }

  try {
    const approveResult = await onchainos<Array<{ dexContractAddress: string }>>("swap approve", {
      token: from, amount: config.swapAmount, chain: "base",
    })
    const approveAddr = approveResult.data?.[0]?.dexContractAddress
    if (approveAddr) {
      const erc20 = new ethers.Contract(from, ERC20_ABI, config.wallet)
      const allowance = await erc20.allowance(config.wallet.address, approveAddr)
      if (allowance < BigInt(config.swapAmount)) {
        const tx = await erc20.approve(approveAddr, ethers.MaxUint256)
        await tx.wait(1)
      }
    }
  } catch (err) {
    console.error(`  Approval error:`, err instanceof Error ? err.message : err)
    return null
  }

  try {
    const tx = await config.wallet.sendTransaction({
      to: txData.to,
      data: txData.data,
      value: txData.value || "0",
      gasLimit: txData.gasLimit ? BigInt(txData.gasLimit) : txData.gas ? BigInt(txData.gas) : undefined,
      gasPrice: txData.gasPrice ? BigInt(txData.gasPrice) : undefined,
    })
    console.log(`  TX sent: ${tx.hash}`)
    const receipt = await tx.wait(1)
    if (!receipt || receipt.status !== 1) { console.error("  TX reverted!"); return null }
    console.log(`  Confirmed in block ${receipt.blockNumber}`)
    return tx.hash
  } catch (err) {
    console.error(`  TX error:`, err instanceof Error ? err.message : err)
    return null
  }
}

export async function publishSignal(arenaUrl: string, apiKey: string, signal: Record<string, unknown>) {
  try {
    const res = await fetch(`${arenaUrl}/api/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify(signal),
    })
    const json = await res.json()
    if (res.ok) console.log(`  Published: ${json.signalId} (price: $${json.marketPrice})`)
    else console.error(`  Publish failed:`, json)
  } catch (err) {
    console.error(`  Network error:`, err)
  }
}

export function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals
}
