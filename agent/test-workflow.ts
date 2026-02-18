/**
 * Vox Full Workflow Test — On-chain bet lifecycle on Monad
 *
 * Since we have a single funded wallet, this test demonstrates:
 * 1. Parse bet from voice transcript
 * 2. Create bet on-chain (locks USDC)
 * 3. Cancel bet (refunds USDC)
 * 4. Show transaction speeds
 *
 * In production with 2 wallets: create → match → resolve → payout
 */

import { parseBetFromTranscript } from "./bet-parser.js";
import { resolveBet } from "./oracle.js";
import {
  generateBetId,
  createBet,
  getStats,
  getUSDCBalance,
} from "./x402-pay.js";
import { formatUnits } from "viem";
import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monad, CONTRACTS, ESCROW_ABI } from "./config.js";

function getAccount() {
  const key = process.env.PRIVATE_KEY!;
  return privateKeyToAccount(key.startsWith("0x") ? key as `0x${string}` : `0x${key}`);
}

async function main() {
  console.log("🎲 PerkOS Vox — Full Workflow Test on Monad");
  console.log("═".repeat(55));

  const account = getAccount();
  const publicClient = createPublicClient({ chain: monad, transport: http() });
  const walletClient = createWalletClient({ account, chain: monad, transport: http() });

  console.log(`\n👤 Account: ${account.address}`);

  // Check balance
  const balance = await getUSDCBalance(account.address as `0x${string}`);
  console.log(`💰 USDC Balance: ${formatUnits(balance, 6)} USDC`);

  if (balance < 100_000n) {
    console.log("❌ Need at least $0.10 USDC. Exiting.");
    process.exit(1);
  }

  const txResults: { step: string; ms: number; hash: string }[] = [];

  // ─── Step 1: Parse bet from transcript ────────────────────────────────
  console.log("\n📝 Step 1: Parse bet from voice transcript");
  const phrases = [
    "I bet you $0.05 that Monad has more TPS than Solana",
    "Bet $0.03 it rains in Denver tomorrow",
    "$0.02 says the capital of France is Paris",
  ];

  for (const phrase of phrases) {
    const parsed = parseBetFromTranscript(phrase);
    if (parsed) {
      console.log(`   ✅ "${phrase}"`);
      console.log(`      → $${parsed.amount} | ${parsed.category} | confidence: ${(parsed.confidence * 100).toFixed(0)}%`);
    }
  }

  // ─── Step 2: Create 3 bets on-chain ───────────────────────────────────
  console.log("\n⛓️  Step 2: Create bets on Monad (locks USDC)");

  // Use a dummy partyB (will cancel, so they don't need to fund)
  const partyB = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" as `0x${string}`;

  for (let i = 0; i < 3; i++) {
    const parsed = parseBetFromTranscript(phrases[i])!;
    const betId = generateBetId(parsed.condition, Date.now() + i);

    const result = await createBet({
      betId,
      partyB,
      amount: parsed.amountUSDC,
      condition: parsed.condition,
      category: parsed.category,
      deadline: parsed.deadline,
    });

    txResults.push({ step: `Create bet #${i + 1}`, ms: result.confirmationMs, hash: result.hash });

    // Cancel to get USDC back for next bet
    console.log(`   🔄 Cancelling bet #${i + 1} (refund)...`);
    const start = Date.now();
    const cancelHash = await walletClient.writeContract({
      address: CONTRACTS.ESCROW,
      abi: ESCROW_ABI,
      functionName: "cancelBet",
      args: [betId],
    });
    await publicClient.waitForTransactionReceipt({ hash: cancelHash });
    const cancelMs = Date.now() - start;
    txResults.push({ step: `Cancel bet #${i + 1}`, ms: cancelMs, hash: cancelHash });
    console.log(`   ✅ Cancelled in ${cancelMs}ms\n`);
  }

  // ─── Step 3: Oracle resolution (off-chain demo) ───────────────────────
  console.log("🔮 Step 3: Oracle resolution (off-chain)");
  const testBet = parseBetFromTranscript(phrases[1])!; // weather bet
  const resolution = await resolveBet(testBet);
  console.log(`   ${resolution.resolved ? "✅" : "⏳"} ${resolution.reason}`);
  console.log(`   Source: ${resolution.source}`);

  // ─── Results ──────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(55));
  console.log("📊 RESULTS — PerkOS Vox on Monad");
  console.log("═".repeat(55));

  const totalMs = txResults.reduce((sum, r) => sum + r.ms, 0);
  const avgMs = Math.round(totalMs / txResults.length);

  console.log(`\n   Total transactions: ${txResults.length}`);
  console.log(`   ─────────────────────────────────────`);
  for (const r of txResults) {
    console.log(`   ${r.step.padEnd(20)} ${String(r.ms).padStart(5)}ms ✅`);
  }
  console.log(`   ─────────────────────────────────────`);
  console.log(`   Total time:         ${totalMs}ms`);
  console.log(`   Average per tx:     ${avgMs}ms`);

  // Comparison
  console.log(`\n   ⚡ Speed comparison (${txResults.length} txs):`);
  console.log(`   🟣 Monad:    ${(totalMs / 1000).toFixed(1)}s (actual)`);
  console.log(`   🔵 Ethereum: ${(txResults.length * 12).toFixed(0)}s (estimated @ 12s/tx)`);
  console.log(`   Monad is ${Math.round((txResults.length * 12000) / totalMs)}x faster! 🔥`);

  // On-chain stats
  const stats = await getStats();
  console.log(`\n   📈 On-chain contract stats:`);
  console.log(`   Total bets created: ${stats.totalBets}`);
  console.log(`   Total volume: ${formatUnits(stats.totalVolume, 6)} USDC`);
  console.log(`   Total resolved: ${stats.totalResolved}`);

  // Final balance
  const finalBalance = await getUSDCBalance(account.address as `0x${string}`);
  console.log(`\n   💰 Final USDC balance: ${formatUnits(finalBalance, 6)} USDC`);
  console.log(`   💸 Gas spent: ~${formatUnits(balance - finalBalance, 6)} USDC worth (in MON)`);

  console.log("\n🎲 PerkOS Vox — Workflow complete! 🟣\n");
}

main().catch((e) => {
  console.error("❌ Error:", e.message || e);
  process.exit(1);
});
