/**
 * Vox Oracle — Resolves bets using external data sources
 */

import type { ParsedBet } from "./bet-parser.js";

export interface Resolution {
  resolved: boolean;
  winner: "partyA" | "partyB" | null;
  reason: string;
  source: string;
  data?: unknown;
}

/**
 * Attempt to resolve a bet based on its category
 */
export async function resolveBet(
  bet: ParsedBet,
  context?: { partyAStatement?: string; partyBStatement?: string }
): Promise<Resolution> {
  switch (bet.category) {
    case "crypto_price":
      return resolveCryptoPrice(bet);
    case "weather":
      return resolveWeather(bet);
    case "trivia":
      return resolveTrivia(bet);
    case "sports":
      return resolveSports(bet);
    case "fun_social":
      return resolveFunSocial(bet, context);
    default:
      return { resolved: false, winner: null, reason: "Unknown category", source: "system" };
  }
}

/**
 * Resolve crypto price bets using CoinGecko
 */
async function resolveCryptoPrice(bet: ParsedBet): Promise<Resolution> {
  try {
    // Extract coin and target price from condition
    const coinMap: Record<string, string> = {
      bitcoin: "bitcoin", btc: "bitcoin",
      ethereum: "ethereum", eth: "ethereum",
      solana: "solana", sol: "solana",
      monad: "monad", mon: "monad",
    };

    let coinId = "bitcoin";
    for (const [keyword, id] of Object.entries(coinMap)) {
      if (bet.condition.toLowerCase().includes(keyword)) {
        coinId = id;
        break;
      }
    }

    // Fetch current price
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );
    const data = await res.json() as Record<string, { usd: number }>;
    const price = data[coinId]?.usd;

    if (!price) {
      return { resolved: false, winner: null, reason: `Could not fetch ${coinId} price`, source: "coingecko" };
    }

    // Extract target from condition
    const targetMatch = bet.condition.match(/(\d[\d,]*\.?\d*)\s*[kK]?/);
    let target = 0;
    if (targetMatch) {
      target = parseFloat(targetMatch[1].replace(/,/g, ""));
      if (bet.condition.toLowerCase().includes("k")) target *= 1000;
    }

    if (target === 0) {
      return { resolved: false, winner: null, reason: "Could not parse target price", source: "coingecko", data: { price } };
    }

    // Check if condition mentions "above" or "below"
    const isAbove = /above|over|hits|reaches|more|higher/i.test(bet.condition);
    const met = isAbove ? price >= target : price < target;

    return {
      resolved: true,
      winner: met ? "partyA" : "partyB",
      reason: `${coinId} price is $${price.toLocaleString()}. Target was $${target.toLocaleString()} (${isAbove ? "above" : "below"}). Condition ${met ? "MET" : "NOT MET"}.`,
      source: "coingecko",
      data: { price, target, met },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { resolved: false, winner: null, reason: `API error: ${msg}`, source: "coingecko" };
  }
}

/**
 * Resolve weather bets using wttr.in
 */
async function resolveWeather(bet: ParsedBet): Promise<Resolution> {
  try {
    // Extract location
    const locMatch = bet.condition.match(/in\s+([A-Za-z\s]+?)(?:\s+tomorrow|\s+today|\s+tonight|$)/i);
    const location = locMatch ? locMatch[1].trim() : "Denver";

    const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
    const data = await res.json() as {
      current_condition: Array<{ weatherDesc: Array<{ value: string }>; temp_F: string }>;
    };

    const condition = data.current_condition?.[0];
    const weather = condition?.weatherDesc?.[0]?.value || "Unknown";
    const tempF = condition?.temp_F || "??";

    const isRainBet = /rain/i.test(bet.condition);
    const isRaining = /rain|drizzle|shower|thunder/i.test(weather);

    return {
      resolved: true,
      winner: (isRainBet && isRaining) || (!isRainBet && !isRaining) ? "partyA" : "partyB",
      reason: `Weather in ${location}: ${weather}, ${tempF}°F. ${isRainBet ? (isRaining ? "It IS raining!" : "No rain.") : ""}`,
      source: "wttr.in",
      data: { weather, tempF, location },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { resolved: false, winner: null, reason: `Weather API error: ${msg}`, source: "wttr.in" };
  }
}

/**
 * Resolve trivia bets using AI knowledge
 */
async function resolveTrivia(bet: ParsedBet): Promise<Resolution> {
  // Simple trivia — for hackathon, the AI agent (OpenClaw) will handle this
  // This is a placeholder that can be called from the agent
  return {
    resolved: false,
    winner: null,
    reason: "Trivia bets require AI judgment — forwarding to Vox agent",
    source: "vox-agent",
  };
}

/**
 * Resolve sports bets
 */
async function resolveSports(bet: ParsedBet): Promise<Resolution> {
  // For hackathon, sports bets resolve via manual confirmation or API
  return {
    resolved: false,
    winner: null,
    reason: "Sports bets pending game result — monitoring",
    source: "sports-api",
  };
}

/**
 * Resolve fun/social bets via mutual confirmation
 */
async function resolveFunSocial(
  bet: ParsedBet,
  context?: { partyAStatement?: string; partyBStatement?: string }
): Promise<Resolution> {
  if (!context?.partyAStatement || !context?.partyBStatement) {
    return {
      resolved: false,
      winner: null,
      reason: "Fun bets need both parties to confirm the outcome",
      source: "mutual-confirmation",
    };
  }

  // Both parties agreed
  const aWins = /i\s*(won|win|did\s+it|made\s+it)/i.test(context.partyAStatement);
  const bConfirms = /yes|correct|true|they\s+won|he\s+won|she\s+won/i.test(context.partyBStatement);

  if (aWins && bConfirms) {
    return { resolved: true, winner: "partyA", reason: "Both parties confirm Party A won", source: "mutual" };
  }

  const bWins = /i\s*(won|win|did\s+it|made\s+it)/i.test(context.partyBStatement);
  const aConfirms = /yes|correct|true|they\s+won|he\s+won|she\s+won/i.test(context.partyAStatement);

  if (bWins && aConfirms) {
    return { resolved: true, winner: "partyB", reason: "Both parties confirm Party B won", source: "mutual" };
  }

  return { resolved: false, winner: null, reason: "Parties disagree — needs arbitration", source: "mutual" };
}

// --- Test ---
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("🔮 Vox Oracle — Test Results\n");

  const testBets: ParsedBet[] = [
    { condition: "Bitcoin hits 100K", amount: 0.25, amountUSDC: 250000n, category: "crypto_price", deadline: 0, confidence: 0.9, rawText: "" },
    { condition: "it rains in Denver tomorrow", amount: 0.10, amountUSDC: 100000n, category: "weather", deadline: 0, confidence: 0.8, rawText: "" },
  ];

  for (const bet of testBets) {
    console.log(`🎲 Resolving: "${bet.condition}" ($${bet.amount}, ${bet.category})`);
    const result = await resolveBet(bet);
    console.log(`   ${result.resolved ? "✅" : "⏳"} ${result.reason}`);
    console.log(`   Source: ${result.source}${result.winner ? ` | Winner: ${result.winner}` : ""}\n`);
  }
}
