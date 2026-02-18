/**
 * Vox x402 Payment Integration — PerkOS Stack + Monad
 *
 * Flow: Sign EIP-3009 authorization → Stack verify → Stack settle → USDC moves on Monad
 *
 * For the hackathon MVP, we use direct contract calls (approve + createBet/matchBet)
 * since both parties' wallets are controlled by the agent.
 * The x402 flow via Stack is the production path.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  keccak256,
  toBytes,
  formatUnits,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monad, CONTRACTS, ESCROW_ABI, ERC20_ABI } from "./config.js";

// ─── Clients ────────────────────────────────────────────────────────────

function getAccount() {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error("PRIVATE_KEY env var required");
  return privateKeyToAccount(key.startsWith("0x") ? key as `0x${string}` : `0x${key}`);
}

const publicClient = createPublicClient({
  chain: monad,
  transport: http(),
});

function getWalletClient() {
  return createWalletClient({
    account: getAccount(),
    chain: monad,
    transport: http(),
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────

export function generateBetId(condition: string, timestamp?: number): `0x${string}` {
  const ts = timestamp || Date.now();
  return keccak256(toBytes(`vox-${condition}-${ts}`));
}

async function ensureApproval(amount: bigint): Promise<Hash | null> {
  const account = getAccount();
  const allowance = await publicClient.readContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, CONTRACTS.ESCROW],
  });

  if ((allowance as bigint) < amount) {
    console.log(`   🔑 Approving USDC spend: ${formatUnits(amount, 6)} USDC`);
    const wallet = getWalletClient();
    const hash = await wallet.writeContract({
      address: CONTRACTS.USDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.ESCROW, amount * 100n], // Approve extra for multiple bets
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   ✅ Approved: ${hash}`);
    return hash;
  }
  return null;
}

// ─── Core Functions ─────────────────────────────────────────────────────

/**
 * Create a new bet on-chain
 */
export async function createBet(params: {
  betId: `0x${string}`;
  partyB: `0x${string}`;
  amount: bigint;          // USDC amount (6 decimals)
  condition: string;
  category: string;
  deadline: number;        // unix timestamp
}): Promise<{ hash: Hash; confirmationMs: number }> {
  const wallet = getWalletClient();
  const start = Date.now();

  // Ensure approval
  await ensureApproval(params.amount);

  console.log(`   🎲 Creating bet: ${params.condition} ($${formatUnits(params.amount, 6)})`);

  const hash = await wallet.writeContract({
    address: CONTRACTS.ESCROW,
    abi: ESCROW_ABI,
    functionName: "createBet",
    args: [
      params.betId,
      params.partyB,
      params.amount,
      params.condition,
      params.category,
      BigInt(params.deadline),
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const confirmationMs = Date.now() - start;

  console.log(`   ✅ Bet created in ${confirmationMs}ms | Block #${receipt.blockNumber}`);
  console.log(`   📎 https://monadscan.com/tx/${hash}`);

  return { hash, confirmationMs };
}

/**
 * Match an existing bet (party B funds their side)
 */
export async function matchBet(params: {
  betId: `0x${string}`;
  amount: bigint;
}): Promise<{ hash: Hash; confirmationMs: number }> {
  const wallet = getWalletClient();
  const start = Date.now();

  await ensureApproval(params.amount);

  console.log(`   🤝 Matching bet...`);

  const hash = await wallet.writeContract({
    address: CONTRACTS.ESCROW,
    abi: ESCROW_ABI,
    functionName: "matchBet",
    args: [params.betId],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const confirmationMs = Date.now() - start;

  console.log(`   ✅ Bet matched in ${confirmationMs}ms | Block #${receipt.blockNumber}`);
  console.log(`   📎 https://monadscan.com/tx/${hash}`);

  return { hash, confirmationMs };
}

/**
 * Resolve a bet (oracle only)
 */
export async function resolveOnChain(params: {
  betId: `0x${string}`;
  winner: `0x${string}`;
}): Promise<{ hash: Hash; confirmationMs: number }> {
  const wallet = getWalletClient();
  const start = Date.now();

  console.log(`   💰 Resolving bet → winner: ${params.winner.slice(0, 10)}...`);

  const hash = await wallet.writeContract({
    address: CONTRACTS.ESCROW,
    abi: ESCROW_ABI,
    functionName: "resolveBet",
    args: [params.betId, params.winner],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const confirmationMs = Date.now() - start;

  console.log(`   ✅ Bet resolved in ${confirmationMs}ms | Block #${receipt.blockNumber}`);
  console.log(`   📎 https://monadscan.com/tx/${hash}`);

  return { hash, confirmationMs };
}

/**
 * Get on-chain stats
 */
export async function getStats(): Promise<{
  totalBets: bigint;
  totalVolume: bigint;
  totalResolved: bigint;
}> {
  const result = await publicClient.readContract({
    address: CONTRACTS.ESCROW,
    abi: ESCROW_ABI,
    functionName: "getStats",
  });

  const [totalBets, totalVolume, totalResolved] = result as [bigint, bigint, bigint];
  return { totalBets, totalVolume, totalResolved };
}

/**
 * Get bet details
 */
export async function getBetDetails(betId: `0x${string}`) {
  return publicClient.readContract({
    address: CONTRACTS.ESCROW,
    abi: ESCROW_ABI,
    functionName: "getBet",
    args: [betId],
  });
}

/**
 * Check USDC balance
 */
export async function getUSDCBalance(address: `0x${string}`): Promise<bigint> {
  const result = await publicClient.readContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  return result as bigint;
}
