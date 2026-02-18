/**
 * Vox Agent Server — Full bet lifecycle on Monad
 * 
 * Flow: Voice → parse → createBet (tx1) → auto matchBet (tx2) → oracle resolve → resolveBet (tx3)
 */
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { parseBetFromTranscript, processOmiMemory, type ParsedBet } from "./bet-parser.js";
import {
  generateBetId,
  createBet,
  getBetDetails,
  getStats,
  getUSDCBalance,
} from "./x402-pay.js";
import { resolveBet as oracleResolve } from "./oracle.js";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monad, CONTRACTS, ESCROW_ABI, ERC20_ABI } from "./config.js";
import * as fs from "node:fs";
import * as path from "node:path";

const PORT = Number(process.env.PORT) || 3000;

const DEFAULT_PARTY_B = (process.env.DEFAULT_PARTY_B || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e") as `0x${string}`;

// ─── Party B wallet (for auto-match) ────────────────────────────────────

const publicClient = createPublicClient({ chain: monad, transport: http() });

function getPartyBAccount() {
  const key = process.env.PARTY_B_PRIVATE_KEY;
  if (!key) throw new Error("PARTY_B_PRIVATE_KEY env var required for matchBet");
  return privateKeyToAccount(key.startsWith("0x") ? key as `0x${string}` : `0x${key}`);
}

function getPartyBWalletClient() {
  return createWalletClient({
    account: getPartyBAccount(),
    chain: monad,
    transport: http(),
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function getDateStr(): string {
  return new Date().toISOString().split("T")[0];
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function parseQuery(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const qi = url.indexOf("?");
  if (qi === -1) return params;
  for (const pair of url.slice(qi + 1).split("&")) {
    const [k, v] = pair.split("=");
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
  }
  return params;
}

const MEMORY_BASE = path.join(process.env.HOME || "/home/ubuntu", "perkos-vox/memory/omi");

// ─── On-chain bet operations ────────────────────────────────────────────

interface OnChainBetResult {
  betId: string;
  txHash: string;
  confirmationMs: number;
  condition: string;
  amount: string;
}

interface LifecycleResult {
  create: { txHash: string; ms: number };
  match?: { txHash: string; ms: number };
  resolve?: { txHash: string; ms: number; winner: string; reason: string };
  totalMs: number;
}

/**
 * Ensure Party B has approved escrow to spend USDC
 */
async function ensurePartyBApproval(amount: bigint): Promise<Hash | null> {
  const account = getPartyBAccount();
  const allowance = await publicClient.readContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, CONTRACTS.ESCROW],
  }) as bigint;

  if (allowance < amount) {
    console.log(`   🔑 [Party B] Approving USDC spend: ${formatUnits(amount, 6)} USDC`);
    const wallet = getPartyBWalletClient();
    const hash = await wallet.writeContract({
      address: CONTRACTS.USDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.ESCROW, amount * 100n],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   ✅ [Party B] Approved: ${hash}`);
    return hash;
  }
  return null;
}

/**
 * Match a bet as Party B
 */
async function matchBetOnChain(betId: `0x${string}`, amount: bigint): Promise<{ hash: Hash; confirmationMs: number }> {
  const wallet = getPartyBWalletClient();
  const start = Date.now();

  await ensurePartyBApproval(amount);

  console.log(`   🤝 [Party B] Matching bet ${betId.slice(0, 10)}...`);
  const hash = await wallet.writeContract({
    address: CONTRACTS.ESCROW,
    abi: ESCROW_ABI,
    functionName: "matchBet",
    args: [betId],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const confirmationMs = Date.now() - start;

  console.log(`   ✅ Bet matched in ${confirmationMs}ms | Block #${receipt.blockNumber}`);
  console.log(`   📎 https://monadscan.com/tx/${hash}`);

  return { hash, confirmationMs };
}

/**
 * Resolve a bet on-chain using the oracle (Party A's wallet = oracle)
 */
async function resolveBetOnChain(betId: `0x${string}`, winner: `0x${string}`): Promise<{ hash: Hash; confirmationMs: number }> {
  // Oracle = Party A wallet (PRIVATE_KEY) since it's set as oracle in the contract
  const key = process.env.PRIVATE_KEY!;
  const account = privateKeyToAccount(key.startsWith("0x") ? key as `0x${string}` : `0x${key}`);
  const wallet = createWalletClient({ account, chain: monad, transport: http() });
  const start = Date.now();

  console.log(`   💰 Resolving bet → winner: ${winner.slice(0, 10)}...`);
  const hash = await wallet.writeContract({
    address: CONTRACTS.ESCROW,
    abi: ESCROW_ABI,
    functionName: "resolveBet",
    args: [betId, winner],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const confirmationMs = Date.now() - start;

  console.log(`   ✅ Bet resolved in ${confirmationMs}ms | Block #${receipt.blockNumber}`);
  console.log(`   📎 https://monadscan.com/tx/${hash}`);

  return { hash, confirmationMs };
}

/**
 * Full auto lifecycle: createBet → matchBet → oracle resolve → resolveBet
 */
async function runFullLifecycle(bet: ParsedBet): Promise<LifecycleResult> {
  const betId = generateBetId(bet.condition, Date.now());
  const totalStart = Date.now();

  // Get Party B address
  const partyBAddr = process.env.PARTY_B_PRIVATE_KEY
    ? getPartyBAccount().address
    : DEFAULT_PARTY_B;

  // Get Party A address
  const keyA = process.env.PRIVATE_KEY!;
  const partyAAddr = privateKeyToAccount(keyA.startsWith("0x") ? keyA as `0x${string}` : `0x${keyA}`).address;

  // ── TX 1: Create Bet ──
  console.log(`\n[${new Date().toISOString()}] ⛓️  === TX 1: CREATE BET ===`);
  const createResult = await createBet({
    betId,
    partyB: partyBAddr as `0x${string}`,
    amount: bet.amountUSDC,
    condition: bet.condition,
    category: bet.category,
    deadline: bet.deadline,
  });

  const result: LifecycleResult = {
    create: { txHash: createResult.hash, ms: createResult.confirmationMs },
    totalMs: 0,
  };

  // ── TX 2: Auto Match (if Party B key available) ──
  if (process.env.PARTY_B_PRIVATE_KEY) {
    console.log(`[${new Date().toISOString()}] ⛓️  === TX 2: MATCH BET (auto) ===`);
    // Small delay for demo effect
    await new Promise((r) => setTimeout(r, 500));

    try {
      const matchResult = await matchBetOnChain(betId, bet.amountUSDC);
      result.match = { txHash: matchResult.hash, ms: matchResult.confirmationMs };

      // ── TX 3: Oracle Resolve ──
      console.log(`[${new Date().toISOString()}] ⛓️  === TX 3: ORACLE RESOLVE ===`);
      await new Promise((r) => setTimeout(r, 500));

      try {
        // Run oracle to determine winner
        const resolution = await oracleResolve(bet);
        let winner: `0x${string}`;

        if (resolution.resolved && resolution.winner) {
          winner = (resolution.winner === "partyA" ? partyAAddr : partyBAddr) as `0x${string}`;
        } else {
          // For demo: if oracle can't resolve, default to partyA
          console.log(`   ⚠️  Oracle undecided: "${resolution.reason}" — defaulting to Party A for demo`);
          winner = partyAAddr as `0x${string}`;
        }

        const resolveResult = await resolveBetOnChain(betId, winner);
        result.resolve = {
          txHash: resolveResult.hash,
          ms: resolveResult.confirmationMs,
          winner: winner,
          reason: resolution.reason,
        };
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] ❌ Resolve failed: ${err.message}`);
      }
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] ❌ Match failed: ${err.message}`);
    }
  }

  result.totalMs = Date.now() - totalStart;

  console.log(`\n[${new Date().toISOString()}] 🏁 Full lifecycle completed in ${result.totalMs}ms`);
  if (result.create) console.log(`   TX1 (create):  ${result.create.ms}ms`);
  if (result.match) console.log(`   TX2 (match):   ${result.match.ms}ms`);
  if (result.resolve) console.log(`   TX3 (resolve): ${result.resolve.ms}ms`);

  return result;
}

async function submitBetFullLifecycle(bet: ParsedBet): Promise<{ betId: string; lifecycle: LifecycleResult }> {
  const lifecycle = await runFullLifecycle(bet);
  return { betId: "", lifecycle };
}

async function submitBetsOnChain(bets: ParsedBet[]): Promise<Array<{ condition: string; amount: string; lifecycle: LifecycleResult }>> {
  if (!process.env.PRIVATE_KEY) {
    console.log(`[${new Date().toISOString()}] ⚠️  PRIVATE_KEY not set — skipping on-chain submission`);
    return [];
  }

  const results: Array<{ condition: string; amount: string; lifecycle: LifecycleResult }> = [];
  for (const bet of bets) {
    try {
      const { lifecycle } = await submitBetFullLifecycle(bet);
      results.push({
        condition: bet.condition,
        amount: formatUnits(bet.amountUSDC, 6),
        lifecycle,
      });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] ❌ On-chain bet failed: ${err.message}`);
    }
  }
  return results;
}

// ─── In-memory bet log ──────────────────────────────────────────────────

const recentBets: Array<ParsedBet & { receivedAt: string; txHash?: string; betId?: string; lifecycle?: LifecycleResult }> = [];

function trackBets(bets: ParsedBet[], onChainResults: Array<{ condition: string; lifecycle: LifecycleResult }>) {
  for (const bet of bets) {
    const onChain = onChainResults.find((r) => r.condition === bet.condition);
    recentBets.push({
      ...bet,
      receivedAt: new Date().toISOString(),
      txHash: onChain?.lifecycle.create.txHash,
      lifecycle: onChain?.lifecycle,
    });
  }
  if (recentBets.length > 100) recentBets.splice(0, recentBets.length - 100);
}

// ─── URL path matching ──────────────────────────────────────────────────

function matchPath(pattern: string, url: string): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const urlParts = url.split("/");
  if (patternParts.length !== urlParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = urlParts[i];
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

// ─── Server ─────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const fullUrl = req.url ?? "/";
  const url = fullUrl.split("?")[0];
  const method = req.method ?? "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  // ── Health ──
  if (url === "/health" && method === "GET") {
    return json(res, 200, {
      status: "ok",
      uptime: process.uptime(),
      betsDetected: recentBets.length,
      lifecycle: process.env.PARTY_B_PRIVATE_KEY ? "full (create+match+resolve)" : "create-only",
    });
  }

  // ── GET /api/bet/:betId — read bet state from contract ──
  const betParams = matchPath("/api/bet/:betId", url);
  if (betParams && method === "GET") {
    try {
      const betId = betParams.betId as `0x${string}`;
      const bet = await getBetDetails(betId) as any;
      const statusNames = ["Pending", "Active", "Resolved", "Cancelled", "Expired"];
      return json(res, 200, {
        id: bet.id,
        partyA: bet.partyA,
        partyB: bet.partyB,
        amount: formatUnits(bet.amount, 6),
        condition: bet.condition,
        category: bet.category,
        deadline: Number(bet.deadline),
        status: statusNames[Number(bet.status)] || "Unknown",
        statusCode: Number(bet.status),
        winner: bet.winner,
        createdAt: Number(bet.createdAt),
        resolvedAt: Number(bet.resolvedAt),
      });
    } catch (err: any) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── POST /api/match/:betId — manually trigger matchBet ──
  const matchParams = matchPath("/api/match/:betId", url);
  if (matchParams && method === "POST") {
    try {
      if (!process.env.PARTY_B_PRIVATE_KEY) {
        return json(res, 400, { error: "PARTY_B_PRIVATE_KEY not configured" });
      }
      const betId = matchParams.betId as `0x${string}`;
      // Read bet to get amount
      const bet = await getBetDetails(betId) as any;
      const result = await matchBetOnChain(betId, bet.amount);
      return json(res, 200, {
        betId,
        txHash: result.hash,
        confirmationMs: result.confirmationMs,
        explorerUrl: `https://monadscan.com/tx/${result.hash}`,
      });
    } catch (err: any) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── POST /api/resolve/:betId — manually trigger oracle + resolveBet ──
  const resolveParams = matchPath("/api/resolve/:betId", url);
  if (resolveParams && method === "POST") {
    try {
      const betId = resolveParams.betId as `0x${string}`;
      const bet = await getBetDetails(betId) as any;

      // Build a ParsedBet for oracle
      const parsedBet: ParsedBet = {
        condition: bet.condition,
        amount: Number(formatUnits(bet.amount, 6)),
        amountUSDC: bet.amount,
        category: bet.category,
        deadline: Number(bet.deadline),
        confidence: 1,
        rawText: bet.condition,
      };

      const resolution = await oracleResolve(parsedBet);
      let winner: `0x${string}`;

      if (resolution.resolved && resolution.winner) {
        winner = (resolution.winner === "partyA" ? bet.partyA : bet.partyB) as `0x${string}`;
      } else {
        // Allow body override
        const body = JSON.parse(await readBody(req).catch(() => "{}"));
        if (body.winner) {
          winner = body.winner as `0x${string}`;
        } else {
          return json(res, 422, {
            error: "Oracle could not resolve",
            reason: resolution.reason,
            hint: "POST with { winner: '0x...' } to manually resolve",
          });
        }
      }

      const result = await resolveBetOnChain(betId, winner);
      return json(res, 200, {
        betId,
        winner,
        oracleReason: resolution.reason,
        txHash: result.hash,
        confirmationMs: result.confirmationMs,
        explorerUrl: `https://monadscan.com/tx/${result.hash}`,
      });
    } catch (err: any) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── GET /api/stats — on-chain contract stats ──
  if (url === "/api/stats" && method === "GET") {
    try {
      const stats = await getStats();
      return json(res, 200, {
        totalBets: Number(stats.totalBets),
        totalVolume: formatUnits(stats.totalVolume, 6),
        totalResolved: Number(stats.totalResolved),
      });
    } catch (err: any) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── POST /api/bet — manually submit a bet (full lifecycle) ──
  if (url === "/api/bet" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const text = body.text || body.condition;
      if (!text) return json(res, 400, { error: "Missing text or condition" });

      const parsed = parseBetFromTranscript(text);
      if (!parsed) return json(res, 400, { error: "Could not parse bet from text" });

      // Override amount if provided
      if (body.amount) {
        parsed.amount = body.amount;
        parsed.amountUSDC = BigInt(Math.round(body.amount * 1_000_000));
      }

      const results = await submitBetsOnChain([parsed]);
      trackBets([parsed], results);

      return json(res, 200, {
        parsed: { condition: parsed.condition, amount: parsed.amount, category: parsed.category },
        onChain: results[0] || null,
      });
    } catch (err: any) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── OmiMesh Status ──
  if (url === "/omimesh/status" && method === "GET") {
    return json(res, 200, {
      ok: true,
      plugin: "omimesh-standalone",
      version: "2.0.0",
      config: { storeMemories: true, storeTranscripts: true, storeAudio: false, notifyAgent: false },
      lifecycle: process.env.PARTY_B_PRIVATE_KEY ? "full" : "create-only",
    });
  }

  // ── OmiMesh Memory ──
  if (url === "/omimesh/memory" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      console.log(`[${new Date().toISOString()}] 🧠 OmiMesh memory received: ${body.id || "unknown"}`);

      if (body.discarded) {
        return json(res, 200, { status: "discarded" });
      }

      ensureDir(MEMORY_BASE);
      const dateStr = getDateStr();
      const filePath = path.join(MEMORY_BASE, `${dateStr}.md`);
      const time = body.created_at
        ? new Date(body.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        : new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      const s = body.structured || {};
      const entry = [
        `## ${s.emoji || "📝"} ${s.title || "Untitled"}`,
        `*${time} — ${s.category || "general"}*`,
        "", s.overview || "", "",
      ];

      if (s.action_items?.length > 0) {
        entry.push("**Action Items:**");
        for (const item of s.action_items) entry.push(`- [${item.completed ? "x" : " "}] ${item.description}`);
        entry.push("");
      }

      if (body.transcript_segments?.length > 0) {
        entry.push("<details>", "<summary>Transcript</summary>", "");
        for (const seg of body.transcript_segments) {
          const speaker = seg.is_user ? "You" : (seg.speaker || "Speaker");
          entry.push(`**${speaker}:** ${seg.text}`);
        }
        entry.push("", "</details>", "");
      }

      fs.appendFileSync(filePath, entry.join("\n") + "\n");

      let bets: ParsedBet[] = [];
      if (body.transcript_segments && body.structured) bets = processOmiMemory(body);

      let onChainResults: Array<{ condition: string; amount: string; lifecycle: LifecycleResult }> = [];
      if (bets.length > 0) {
        console.log(`[${new Date().toISOString()}] 🎲 Detected ${bets.length} bet(s) from memory`);
        onChainResults = await submitBetsOnChain(bets);
        trackBets(bets, onChainResults);
      }

      return json(res, 200, { status: "stored", betsDetected: bets.length, onChain: onChainResults });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] ❌ OmiMesh memory error:`, err.message);
      return json(res, 400, { error: "Invalid payload" });
    }
  }

  // ── OmiMesh Transcript ──
  if (url === "/omimesh/transcript" && method === "POST") {
    try {
      const query = parseQuery(fullUrl);
      const sessionId = query.session_id || "default";
      const bodyStr = await readBody(req);
      const segments = JSON.parse(bodyStr);

      console.log(`[${new Date().toISOString()}] 📝 OmiMesh transcript: ${Array.isArray(segments) ? segments.length : 1} segment(s), session=${sessionId}`);

      const transcriptDir = path.join(MEMORY_BASE, "transcripts");
      ensureDir(transcriptDir);
      const dateStr = getDateStr();
      const tFile = path.join(transcriptDir, `${dateStr}-${sessionId}.jsonl`);

      const segs = Array.isArray(segments) ? segments : [segments];
      for (const seg of segs) {
        fs.appendFileSync(tFile, JSON.stringify({ ...seg, timestamp: Date.now() }) + "\n");
      }

      const mdFile = path.join(MEMORY_BASE, `${dateStr}.md`);
      let bets: ParsedBet[] = [];

      for (const seg of segs) {
        const text = seg.text || "";
        if (text.trim()) {
          const speaker = seg.is_user ? "You" : (seg.speaker || "Speaker");
          const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          fs.appendFileSync(mdFile, `> **${speaker}** (${timeStr}): ${text}\n`);

          const parsed = parseBetFromTranscript(text);
          if (parsed && parsed.confidence >= 0.5) bets.push(parsed);
        }
      }

      let onChainResults: Array<{ condition: string; amount: string; lifecycle: LifecycleResult }> = [];
      if (bets.length > 0) {
        console.log(`[${new Date().toISOString()}] 🎲 Detected ${bets.length} bet(s) from transcript`);
        onChainResults = await submitBetsOnChain(bets);
        trackBets(bets, onChainResults);
      }

      return json(res, 200, { status: "stored", segments: segs.length, betsDetected: bets.length, onChain: onChainResults });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] ❌ OmiMesh transcript error:`, err.message);
      return json(res, 400, { error: "Invalid payload" });
    }
  }

  // ── OmiMesh Audio ──
  if (url === "/omimesh/audio" && method === "POST") {
    return json(res, 200, { status: "ok", message: "Audio storage disabled" });
  }

  // ── OmiMesh Summary ──
  if (url === "/omimesh/summary" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      ensureDir(MEMORY_BASE);
      const dateStr = getDateStr();
      const filePath = path.join(MEMORY_BASE, `${dateStr}.md`);
      const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      fs.appendFileSync(filePath, `\n### 📋 Summary (${time})\n${body.summary || body.text || JSON.stringify(body)}\n\n`);
      return json(res, 200, { status: "stored" });
    } catch (err: any) {
      return json(res, 400, { error: "Invalid payload" });
    }
  }

  // ── Legacy webhook ──
  if (url === "/webhook/transcript" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      console.log(`[${new Date().toISOString()}] 📩 Webhook received`);

      let bets: ParsedBet[] = [];
      if (body.transcript_segments && body.structured) {
        bets = processOmiMemory(body);
      } else if (body.text) {
        const parsed = parseBetFromTranscript(body.text);
        if (parsed) bets = [parsed];
      } else if (Array.isArray(body.segments)) {
        for (const seg of body.segments) {
          const parsed = parseBetFromTranscript(seg.text ?? seg);
          if (parsed && parsed.confidence >= 0.5) bets.push(parsed);
        }
      }

      let onChainResults: Array<{ condition: string; amount: string; lifecycle: LifecycleResult }> = [];
      if (bets.length > 0) {
        console.log(`[${new Date().toISOString()}] 🎲 Detected ${bets.length} bet(s)`);
        onChainResults = await submitBetsOnChain(bets);
        trackBets(bets, onChainResults);
      }

      return json(res, 200, {
        betsDetected: bets.length,
        bets: bets.map((b) => ({ condition: b.condition, amount: b.amount, category: b.category, confidence: b.confidence })),
        onChain: onChainResults,
      });
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ❌ Webhook error:`, err);
      return json(res, 400, { error: "Invalid payload" });
    }
  }

  // Recent bets
  if (url === "/bets" && method === "GET") {
    return json(res, 200, { count: recentBets.length, bets: recentBets.slice(-20) });
  }

  // 404
  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`🎙️  Vox Agent Server v2.0 — Full Bet Lifecycle on Monad`);
  console.log(`   ⛓️  On-chain: ${process.env.PRIVATE_KEY ? "ENABLED" : "DISABLED"}`);
  console.log(`   🤝 Auto-match: ${process.env.PARTY_B_PRIVATE_KEY ? "ENABLED" : "DISABLED"}`);
  console.log(`   🔮 Auto-resolve: ${process.env.PARTY_B_PRIVATE_KEY ? "ENABLED" : "DISABLED"}`);
  console.log(`   ─── API Endpoints ───`);
  console.log(`   POST /api/bet          — Submit bet (full lifecycle)`);
  console.log(`   GET  /api/bet/:betId   — Read bet state from contract`);
  console.log(`   POST /api/match/:betId — Manually match a bet`);
  console.log(`   POST /api/resolve/:betId — Oracle resolve + payout`);
  console.log(`   GET  /api/stats        — On-chain contract stats`);
  console.log(`   ─── Webhooks ───`);
  console.log(`   POST /webhook/transcript — Legacy webhook`);
  console.log(`   POST /omimesh/memory     — Omi memory webhook`);
  console.log(`   POST /omimesh/transcript — Omi real-time transcript`);
  console.log(`   GET  /health             — Health check`);
  console.log(`   GET  /bets              — Recent detected bets`);
});
