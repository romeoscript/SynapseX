/**
 * DEX swap execution via OnchainOS CLI (OKX DEX aggregator).
 *
 * Flow:
 * 1. onchainos swap swap  → get unsigned TX data
 * 2. onchainos swap approve → get correct DEX spender address
 * 3. ethers.js approve + sign + broadcast
 */

import { ethers } from "ethers"
import { XLAYER_RPC, USDT_ADDRESS, swapExecute, onchainos, getMarketPrice } from "@ethy-arena/shared"

const provider = new ethers.JsonRpcProvider(XLAYER_RPC)
const ERC20_ABI = [
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]

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

export async function executeSwap(params: {
  fromToken: string
  toToken: string
  amount: string
  wallet: ethers.Wallet
}): Promise<{ txHash: string; toAmount: string } | null> {
  try {
    // 1. Get swap TX data from OnchainOS (OKX DEX aggregator)
    const result = await swapExecute({
      from: params.fromToken,
      to: params.toToken,
      amount: params.amount,
      wallet: params.wallet.address,
      chain: "xlayer",
      slippage: "1",
    })

    if (!result.ok || !result.data) {
      console.error("  OnchainOS swap error:", result.error)
      return null
    }

    const data = Array.isArray(result.data) ? result.data[0] : result.data
    const txData = (data as Record<string, unknown>).tx as {
      to: string; data: string; value: string; gas?: string; gasLimit?: string; gasPrice?: string
    } | undefined
    const toTokenAmount = (data as Record<string, unknown>).toTokenAmount as string | undefined

    if (!txData) {
      console.error("  No TX data in swap response")
      return null
    }

    console.log(`  Swap quote: ${toTokenAmount || "?"} tokens (via OnchainOS)`)

    // 2. Ensure token approval for DEX (get correct spender from onchainos)
    try {
      const approveResult = await onchainos<Array<{ dexContractAddress: string }>>("swap approve", {
        token: params.fromToken,
        amount: params.amount,
        chain: "xlayer",
      })
      const approveAddr = approveResult.data?.[0]?.dexContractAddress
      if (approveAddr) {
        await ensureApproval(params.wallet, params.fromToken, approveAddr)
      }
    } catch (err) {
      console.error(`  Approval failed:`, err instanceof Error ? err.message : err)
      return null
    }

    // 3. Sign and send the swap TX
    const signer = params.wallet.connect(provider)
    const nonce = await provider.getTransactionCount(params.wallet.address)

    const txRequest: ethers.TransactionRequest = {
      to: txData.to,
      data: txData.data,
      value: txData.value || "0",
      nonce,
    }

    // Use gas fields from response (onchainos may return gas or gasLimit)
    if (txData.gasLimit) txRequest.gasLimit = BigInt(txData.gasLimit)
    else if (txData.gas) txRequest.gasLimit = BigInt(txData.gas)
    if (txData.gasPrice) txRequest.gasPrice = BigInt(txData.gasPrice)

    const txResponse = await signer.sendTransaction(txRequest)
    console.log(`  Swap TX sent: ${txResponse.hash}`)

    const receipt = await txResponse.wait(1)
    if (!receipt || receipt.status !== 1) {
      console.error("  TX reverted!")
      return null
    }

    console.log(`  Swap confirmed in block ${receipt.blockNumber}`)
    return { txHash: txResponse.hash, toAmount: toTokenAmount || "0" }
  } catch (err) {
    console.error("  Swap execution error:", err instanceof Error ? err.message : err)
    return null
  }
}

/** Sell tokens back to USDT (close position). */
export async function executeSellSwap(params: {
  tokenAddress: string
  tokenAmount: string
  wallet: ethers.Wallet
}): Promise<{ txHash: string; usdtAmount: string } | null> {
  const result = await executeSwap({
    fromToken: params.tokenAddress,
    toToken: USDT_ADDRESS,
    amount: params.tokenAmount,
    wallet: params.wallet,
  })
  if (!result) return null
  return { txHash: result.txHash, usdtAmount: result.toAmount }
}

/** Fetch the current price of a token via OnchainOS. */
export async function getCurrentPrice(tokenAddress: string): Promise<number | null> {
  const result = await getMarketPrice(tokenAddress, "xlayer")
  if (!result.ok || !result.data || !result.data.length) return null
  return parseFloat(result.data[0].price)
}
