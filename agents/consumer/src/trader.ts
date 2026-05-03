/**
 * DEX swap execution via OnchainOS CLI (chain: "base").
 */

import { ethers } from "ethers"
import { BASE_RPC, USDC_ADDRESS, swapExecute, onchainos, getMarketPrice } from "@ethy-arena/shared"

const provider = new ethers.JsonRpcProvider(BASE_RPC)

const ERC20_ABI = [
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]

async function ensureApproval(wallet: ethers.Wallet, tokenAddress: string, spender: string) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet)
  const allowance = await token.allowance(wallet.address, spender)
  if (allowance < BigInt("0xffffffffffffff")) {
    const tx = await token.approve(spender, ethers.MaxUint256)
    await tx.wait(1)
    console.log(`  Approved ${spender.slice(0, 10)}...`)
  }
}

export async function executeSwap(params: {
  fromToken: string
  toToken: string
  amount: string
  wallet: ethers.Wallet
}): Promise<{ txHash: string; toAmount: string } | null> {
  try {
    const result = await swapExecute({
      from: params.fromToken,
      to: params.toToken,
      amount: params.amount,
      wallet: params.wallet.address,
      chain: "base",
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

    if (!txData) { console.error("  No TX data"); return null }

    // Approve DEX spender
    try {
      const approveResult = await onchainos<Array<{ dexContractAddress: string }>>("swap approve", {
        token: params.fromToken, amount: params.amount, chain: "base",
      })
      const spender = approveResult.data?.[0]?.dexContractAddress
      if (spender) await ensureApproval(params.wallet.connect(provider), params.fromToken, spender)
    } catch (err) {
      console.error("  Approval error:", err instanceof Error ? err.message : err)
      return null
    }

    const signer = params.wallet.connect(provider)
    const txResponse = await signer.sendTransaction({
      to: txData.to,
      data: txData.data,
      value: txData.value || "0",
      gasLimit: txData.gasLimit ? BigInt(txData.gasLimit) : txData.gas ? BigInt(txData.gas) : undefined,
      gasPrice: txData.gasPrice ? BigInt(txData.gasPrice) : undefined,
    })
    console.log(`  Swap TX: ${txResponse.hash}`)
    const receipt = await txResponse.wait(1)
    if (!receipt || receipt.status !== 1) { console.error("  TX reverted!"); return null }
    return { txHash: txResponse.hash, toAmount: toTokenAmount || "0" }
  } catch (err) {
    console.error("  Swap error:", err instanceof Error ? err.message : err)
    return null
  }
}

export async function executeSellSwap(params: {
  tokenAddress: string
  tokenAmount: string
  wallet: ethers.Wallet
}): Promise<{ txHash: string; usdcAmount: string } | null> {
  const result = await executeSwap({
    fromToken: params.tokenAddress,
    toToken: USDC_ADDRESS,
    amount: params.tokenAmount,
    wallet: params.wallet,
  })
  if (!result) return null
  return { txHash: result.txHash, usdcAmount: result.toAmount }
}

export async function getCurrentPrice(tokenAddress: string): Promise<number | null> {
  const result = await getMarketPrice(tokenAddress, "base")
  if (!result.ok || !result.data?.length) return null
  return parseFloat(result.data[0].price)
}
