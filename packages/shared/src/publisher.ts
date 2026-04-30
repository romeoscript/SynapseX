/**
 * Shared publisher agent utilities.
 * Used by publisher-ethy and _local (AlphaQuant) agents.
 */

import { ethers } from "ethers"
import { USDT_ADDRESS } from "./constants.js"
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
    return {
      agentId: wallet.toLowerCase(),
      apiKey: process.env.PUBLISHER_API_KEY,
      registeredAt: "env",
    }
  }
  if (!existsSync(stateFile)) return null
  try {
    return JSON.parse(readFileSync(stateFile, "utf-8"))
  } catch {
    return null
  }
}

export function savePublisherState(stateFile: string, state: PublisherState) {
  writeFileSync(stateFile, JSON.stringify(state, null, 2))
  console.log(`  State saved to ${stateFile}`)
}

export async function signX402Payment(
  wallet: ethers.Wallet,
  accept: { maxAmountRequired: string; asset: string; payTo: string; chainIndex: string },
) {
  const nonce = ethers.hexlify(ethers.randomBytes(32))
  const validBefore = String(Math.floor(Date.now() / 1000) + 300)

  const signature = await wallet.signTypedData(
    {
      name: "USD₮0",
      version: "1",
      chainId: Number(accept.chainIndex),
      verifyingContract: accept.asset,
    },
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
    {
      from: wallet.address,
      to: accept.payTo,
      value: accept.maxAmountRequired,
      validAfter: "0",
      validBefore,
      nonce,
    },
  )

  return {
    x402Version: 1,
    scheme: "exact",
    chainIndex: accept.chainIndex,
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
  console.log(`  Registering wallet ${config.wallet.address} on Arena...`)

  const body = {
    name: config.name,
    description: config.description,
    pricePerQuery: config.pricePerQuery,
  }

  const res402 = await fetch(`${config.arenaUrl}/api/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (res402.status === 409) {
    console.log("  Agent already registered. Set PUBLISHER_API_KEY env var.")
    process.exit(1)
  }

  if (res402.status !== 402) {
    const err = await res402.text()
    throw new Error(`Expected 402, got ${res402.status}: ${err}`)
  }

  const payReqHeader = res402.headers.get("PAYMENT-REQUIRED")
  if (!payReqHeader) throw new Error("No PAYMENT-REQUIRED header in 402 response")
  const payReq = JSON.parse(Buffer.from(payReqHeader, "base64").toString())
  const accept = payReq.accepts[0]
  console.log(`  Payment required: ${accept.maxAmountRequired}`)

  console.log(`  Signing x402 payment...`)
  const paymentPayload = await signX402Payment(config.wallet, accept)
  const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64")

  const res = await fetch(`${config.arenaUrl}/api/agents/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": paymentHeader,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Registration failed: ${JSON.stringify(err)}`)
  }

  const registration = await res.json() as { agentId: string; apiKey: string }
  console.log(`  Registered! Agent ID: ${registration.agentId}`)

  const state: PublisherState = {
    agentId: registration.agentId,
    apiKey: registration.apiKey,
    registeredAt: new Date().toISOString(),
  }
  savePublisherState(config.stateFile, state)
  return state
}

async function ensureApproval(wallet: ethers.Wallet, tokenAddress: string, spender: string) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet)
  const allowance = await token.allowance(wallet.address, spender)
  if (allowance < BigInt("0xffffffffffffff")) {
    console.log(`  Approving ${spender.slice(0, 10)}... to spend token...`)
    const tx = await token.approve(spender, ethers.MaxUint256)
    await tx.wait(1)
    console.log(`  Approved!`)
  }
}

export async function executePublisherSwap(config: {
  tokenAddress: string
  action: "BUY" | "SELL"
  swapAmount: string
  wallet: ethers.Wallet
}): Promise<string | null> {
  console.log(`  Executing ${config.action} swap on X Layer...`)

  const from = config.action === "BUY" ? USDT_ADDRESS : config.tokenAddress
  const to = config.action === "BUY" ? config.tokenAddress : USDT_ADDRESS

  const result = await swapExecute({
    from,
    to,
    amount: config.swapAmount,
    wallet: config.wallet.address,
    chain: "xlayer",
    slippage: "1",
  })

  if (!result.ok || !result.data) {
    console.error(`  Swap quote failed: ${result.error}`)
    return null
  }

  const swapData = Array.isArray(result.data) ? result.data[0] : result.data
  const txData = (swapData as Record<string, unknown>).tx as {
    to: string; data: string; value: string; gas: string; gasPrice: string
  } | undefined

  if (!txData) {
    console.error("  No TX data in swap response")
    return null
  }

  try {
    const approveResult = await onchainos<Array<{ dexContractAddress: string }>>("swap approve", {
      token: from,
      amount: config.swapAmount,
      chain: "xlayer",
    })
    const approveAddr = approveResult.data?.[0]?.dexContractAddress
    if (approveAddr) {
      await ensureApproval(config.wallet, from, approveAddr)
    }
  } catch (err) {
    console.error(`  Approval failed:`, err instanceof Error ? err.message : err)
    return null
  }

  try {
    const nonce = await config.wallet.provider!.getTransactionCount(config.wallet.address)

    const tx = await config.wallet.sendTransaction({
      to: txData.to,
      data: txData.data,
      value: txData.value || "0",
      gasLimit: BigInt(txData.gas),
      gasPrice: BigInt(txData.gasPrice),
      nonce,
    })

    console.log(`  TX sent: ${tx.hash}`)
    const receipt = await tx.wait(1)
    if (!receipt || receipt.status !== 1) {
      console.error("  TX reverted!")
      return null
    }

    console.log(`  Swap confirmed in block ${receipt.blockNumber}`)
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
    if (res.ok) {
      console.log(`  Published: ${json.signalId} (price: $${json.marketPrice})`)
    } else {
      console.error(`  Publish failed:`, json)
    }
  } catch (err) {
    console.error(`  Network error:`, err)
  }
}

export function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals
}
