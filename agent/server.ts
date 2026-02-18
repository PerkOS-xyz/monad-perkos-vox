/**
 * Vox Agent Server — HTTP entry point for OmiMesh webhooks + bet detection + on-chain createBet
 */
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { parseBetFromTranscript, processOmiMemory, type ParsedBet } from "./bet-parser.js";
import { generateBetId, createBet } from "./x402-pay.js";
import { formatUnits } from "viem";
import * as fs from "node:fs";
import * as path from "node:path";

const PORT = Number(process.env.PORT) || 3000;

// Default partyB for MVP (open bets anyone can match)
const DEFAULT_PARTY_B = (process.env.DEFAULT_PARTY_B || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e") as `0x${string}`;

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
  res.writeHead(status, { "Content-Type": "application/json" });
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

// ─── On-chain bet submission ────────────────────────────────────────────

interface OnChainBetResult {
  betId: string;
  txHash: string;
  confirmationMs: number;
  condition: string;
  amount: string;
}

async function submitBetOnChain(bet: ParsedBet): Promise<OnChainBetResult> {
  const betId = generateBetId(bet.condition, Date.now());
  console.log(`[${new Date().toISOString()}] ⛓️  Submitting bet on-chain: "${bet.condition}" ($${bet.amount})`);

  const result = await createBet({
    betId,
    partyB: DEFAULT_PARTY_B,
    amount: bet.amountUSDC,
    condition: bet.condition,
    category: bet.category,
    deadline: bet.deadline,
  });

  console.log(`[${new Date().toISOString()}] ✅ Bet on-chain! tx: ${result.hash} (${result.confirmationMs}ms)`);

  return {
    betId,
    txHash: result.hash,
    confirmationMs: result.confirmationMs,
    condition: bet.condition,
    amount: formatUnits(bet.amountUSDC, 6),
  };
}

async function submitBetsOnChain(bets: ParsedBet[]): Promise<OnChainBetResult[]> {
  if (!process.env.PRIVATE_KEY) {
    console.log(`[${new Date().toISOString()}] ⚠️  PRIVATE_KEY not set — skipping on-chain submission`);
    return [];
  }

  const results: OnChainBetResult[] = [];
  for (const bet of bets) {
    try {
      const r = await submitBetOnChain(bet);
      results.push(r);
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] ❌ On-chain bet failed: ${err.message}`);
    }
  }
  return results;
}

// ─── In-memory bet log ──────────────────────────────────────────────────

const recentBets: Array<ParsedBet & { receivedAt: string; txHash?: string; betId?: string }> = [];

function trackBets(bets: ParsedBet[], onChainResults: OnChainBetResult[]) {
  for (const bet of bets) {
    const onChain = onChainResults.find((r) => r.condition === bet.condition);
    recentBets.push({
      ...bet,
      receivedAt: new Date().toISOString(),
      txHash: onChain?.txHash,
      betId: onChain?.betId,
    });
  }
  if (recentBets.length > 100) recentBets.splice(0, recentBets.length - 100);
}

// ─── Server ─────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const fullUrl = req.url ?? "/";
  const url = fullUrl.split("?")[0];
  const method = req.method ?? "GET";

  // ── Health ──
  if (url === "/health" && method === "GET") {
    return json(res, 200, { status: "ok", uptime: process.uptime(), betsDetected: recentBets.length });
  }

  // ── OmiMesh Status ──
  if (url === "/omimesh/status" && method === "GET") {
    return json(res, 200, {
      ok: true,
      plugin: "omimesh-standalone",
      version: "1.1.0",
      config: { storeMemories: true, storeTranscripts: true, storeAudio: false, notifyAgent: false },
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

      // Store memory markdown
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
        "",
        s.overview || "",
        "",
      ];

      if (s.action_items?.length > 0) {
        entry.push("**Action Items:**");
        for (const item of s.action_items) {
          entry.push(`- [${item.completed ? "x" : " "}] ${item.description}`);
        }
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
      console.log(`[${new Date().toISOString()}] 🧠 Stored memory: ${s.title || "Untitled"}`);

      // Pipe through bet parser → on-chain
      let bets: ParsedBet[] = [];
      if (body.transcript_segments && body.structured) {
        bets = processOmiMemory(body);
      }

      let onChainResults: OnChainBetResult[] = [];
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

  // ── OmiMesh Transcript (real-time segments) ──
  if (url === "/omimesh/transcript" && method === "POST") {
    try {
      const query = parseQuery(fullUrl);
      const sessionId = query.session_id || "default";
      const bodyStr = await readBody(req);
      const segments = JSON.parse(bodyStr);

      console.log(`[${new Date().toISOString()}] 📝 OmiMesh transcript: ${Array.isArray(segments) ? segments.length : 1} segment(s), session=${sessionId}`);

      // Store as JSONL
      const transcriptDir = path.join(MEMORY_BASE, "transcripts");
      ensureDir(transcriptDir);
      const dateStr = getDateStr();
      const tFile = path.join(transcriptDir, `${dateStr}-${sessionId}.jsonl`);

      const segs = Array.isArray(segments) ? segments : [segments];
      for (const seg of segs) {
        fs.appendFileSync(tFile, JSON.stringify({ ...seg, timestamp: Date.now() }) + "\n");
      }

      // Store human-readable and pipe through bet parser
      const mdFile = path.join(MEMORY_BASE, `${dateStr}.md`);
      let bets: ParsedBet[] = [];

      for (const seg of segs) {
        const text = seg.text || "";
        if (text.trim()) {
          const speaker = seg.is_user ? "You" : (seg.speaker || "Speaker");
          const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          fs.appendFileSync(mdFile, `> **${speaker}** (${timeStr}): ${text}\n`);

          const parsed = parseBetFromTranscript(text);
          if (parsed && parsed.confidence >= 0.5) {
            bets.push(parsed);
          }
        }
      }

      // Submit detected bets on-chain
      let onChainResults: OnChainBetResult[] = [];
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
    console.log(`[${new Date().toISOString()}] 🔊 OmiMesh audio received (not stored)`);
    return json(res, 200, { status: "ok", message: "Audio storage disabled" });
  }

  // ── OmiMesh Summary ──
  if (url === "/omimesh/summary" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      console.log(`[${new Date().toISOString()}] 📋 OmiMesh summary received`);

      ensureDir(MEMORY_BASE);
      const dateStr = getDateStr();
      const filePath = path.join(MEMORY_BASE, `${dateStr}.md`);
      const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      fs.appendFileSync(filePath, `\n### 📋 Summary (${time})\n${body.summary || body.text || JSON.stringify(body)}\n\n`);

      return json(res, 200, { status: "stored" });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] ❌ OmiMesh summary error:`, err.message);
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

      // Submit detected bets on-chain
      let onChainResults: OnChainBetResult[] = [];
      if (bets.length > 0) {
        console.log(`[${new Date().toISOString()}] 🎲 Detected ${bets.length} bet(s):`);
        for (const bet of bets) {
          console.log(`   → $${bet.amount} | ${bet.category} | "${bet.condition}"`);
        }
        onChainResults = await submitBetsOnChain(bets);
        trackBets(bets, onChainResults);
      } else {
        console.log(`[${new Date().toISOString()}] 💬 No bets detected in transcript`);
      }

      return json(res, 200, {
        betsDetected: bets.length,
        bets: bets.map((b) => ({
          condition: b.condition,
          amount: b.amount,
          category: b.category,
          confidence: b.confidence,
        })),
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
  console.log(`🎙️  Vox Agent Server running on port ${PORT}`);
  console.log(`   ⛓️  On-chain: ${process.env.PRIVATE_KEY ? "ENABLED (Monad)" : "DISABLED (no PRIVATE_KEY)"}`);
  console.log(`   POST /webhook/transcript — Legacy webhook`);
  console.log(`   GET  /omimesh/status — OmiMesh status`);
  console.log(`   POST /omimesh/memory — Omi memory webhook`);
  console.log(`   POST /omimesh/transcript — Omi real-time transcript`);
  console.log(`   POST /omimesh/audio — Omi audio (disabled)`);
  console.log(`   POST /omimesh/summary — Omi summary`);
  console.log(`   GET  /health — Health check`);
  console.log(`   GET  /bets — Recent detected bets`);
});
