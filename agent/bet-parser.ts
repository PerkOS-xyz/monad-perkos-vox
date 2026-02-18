/**
 * Vox Bet Parser — Detects and structures bets from Omi transcripts
 */

export interface ParsedBet {
  condition: string;
  amount: number;          // in USD
  amountUSDC: bigint;      // in USDC (6 decimals)
  category: "crypto_price" | "weather" | "sports" | "trivia" | "fun_social";
  deadline: number;        // unix timestamp
  confidence: number;      // 0-1 how confident we are this is a bet
  rawText: string;
}

// Bet trigger patterns
const BET_TRIGGERS = [
  /\bi\s*bet\s*(you\s*)?\$?(\d+\.?\d*)/i,
  /\bbet\s*(you\s*)?\$?(\d+\.?\d*)/i,
  /\bi\s*bet\s+you\s+(a\s+dollar|a\s+buck|half\s+a\s+dollar|fifty\s+cents|\d+\s*cents|\d+\s*bucks?)/i,
  /\bwanna\s+bet\b/i,
  /\$(\d+\.?\d*)\s*(says|that|on)\b/i,
  /\bput\s+\$?(\d+\.?\d*)\s+on\b/i,
  /\bi('|')ll\s+bet\s+\$?(\d+\.?\d*)/i,
  /\bi('|')ll\s+bet\s+(a\s+dollar|a\s+buck|half\s+a\s+dollar|fifty\s+cents)/i,
  /\bi\s*bet\s+you\s+(ten|twenty|thirty|fifty|five|fifteen|twenty\s*five)\s+cents/i,
  /\bno\s+way\s+that\b/i,
  /\byou('|')re\s+wrong\b/i,
];

// Category detection
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  crypto_price: [
    /\b(bitcoin|btc|ethereum|eth|solana|sol|monad|mon|crypto|coin|token|price)\b/i,
    /\b(hits|reaches|above|below|over|under)\s+\$?\d/i,
  ],
  weather: [
    /\b(rain|snow|sunny|weather|temperature|degrees|cold|hot|storm|wind)\b/i,
    /\b(tomorrow|tonight|this\s+week|forecast)\b/i,
  ],
  sports: [
    /\b(lakers|celtics|warriors|nfl|nba|mlb|game|score|win|lose|championship|super\s*bowl)\b/i,
    /\b(team|player|match|tournament)\b/i,
  ],
  trivia: [
    /\b(capital|population|president|who\s+(is|was)|what\s+(is|was)|how\s+many|when\s+did)\b/i,
    /\b(fact|true|false|correct|wrong|actually)\b/i,
  ],
};

/**
 * Parse a transcript segment for bet intent
 */
export function parseBetFromTranscript(text: string): ParsedBet | null {
  let amount = 0;
  let confidence = 0;

  // Check for bet triggers
  for (const pattern of BET_TRIGGERS) {
    const match = text.match(pattern);
    if (match) {
      confidence += 0.3;
      // Extract amount from capture groups
      for (let i = 1; i <= match.length; i++) {
        const val = parseFloat(match[i]);
        if (!isNaN(val) && val > 0) {
          amount = val;
          confidence += 0.3;
          break;
        }
      }
    }
  }

  if (confidence < 0.3) return null;

  // Handle "cents" — e.g. "50 cents" → $0.50
  const centsMatch = text.match(/(\d+)\s*cents/i);
  if (centsMatch) {
    amount = parseInt(centsMatch[1]) / 100;
  }

  // Handle word amounts — "half a dollar" → $0.50, "a dollar" → $1, "five bucks" → $5
  const wordAmounts: Record<string, number> = {
    "half a dollar": 0.50, "fifty cents": 0.50, "quarter": 0.25,
    "ten cents": 0.10, "twenty cents": 0.20, "twenty five cents": 0.25,
    "five cents": 0.05, "fifteen cents": 0.15, "thirty cents": 0.30,
    "a dime": 0.10, "a nickel": 0.05,
    "a dollar": 1, "one dollar": 1, "a buck": 1, "one buck": 1,
    "two dollars": 2, "two bucks": 2, "five dollars": 5, "five bucks": 5,
    "ten dollars": 10, "ten bucks": 10,
  };
  const lower = text.toLowerCase();
  for (const [phrase, val] of Object.entries(wordAmounts)) {
    if (lower.includes(phrase)) { amount = val; confidence += 0.3; break; }
  }

  // Default amount if none detected
  if (amount === 0) amount = 0.10;

  // Clamp to limits
  amount = Math.max(0.01, Math.min(10.0, amount));

  // Detect category
  let category: ParsedBet["category"] = "fun_social";
  for (const [cat, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const p of patterns) {
      if (p.test(text)) {
        category = cat as ParsedBet["category"];
        confidence += 0.1;
        break;
      }
    }
  }

  // Extract condition (the part after "bet" or "that")
  let condition = text;
  const conditionMatch = text.match(/(?:bet\s+(?:you\s+)?(?:\$[\d.]+\s+)?(?:that\s+)?)(.*)/i);
  if (conditionMatch) {
    condition = conditionMatch[1].trim();
  }

  // Default deadline: 24 hours
  const deadline = Math.floor(Date.now() / 1000) + 86400;

  return {
    condition,
    amount,
    amountUSDC: BigInt(Math.round(amount * 1_000_000)),
    category,
    deadline,
    confidence: Math.min(1, confidence),
    rawText: text,
  };
}

/**
 * Process an OmiMesh memory payload for bets
 */
export function processOmiMemory(payload: {
  transcript_segments: Array<{ text: string; speaker: string; is_user: boolean }>;
  structured: { title: string; overview: string };
}): ParsedBet[] {
  const bets: ParsedBet[] = [];

  for (const segment of payload.transcript_segments) {
    const parsed = parseBetFromTranscript(segment.text);
    if (parsed && parsed.confidence >= 0.5) {
      bets.push(parsed);
    }
  }

  // Also check the overview
  const overviewBet = parseBetFromTranscript(payload.structured.overview);
  if (overviewBet && overviewBet.confidence >= 0.6) {
    bets.push(overviewBet);
  }

  return bets;
}

// --- Test ---
if (import.meta.url === `file://${process.argv[1]}`) {
  const testPhrases = [
    "I bet you $0.25 that Bitcoin hits 100K by end of month",
    "Wanna bet? No way the Lakers win tonight",
    "$0.50 says it rains tomorrow in Denver",
    "I bet you can't name 5 Monad features in 10 seconds",
    "The capital of Mongolia is Ulaanbaatar, bet you $0.10 it's not",
    "Just a normal conversation about lunch",
    "I'll bet $1 that Ethereum flips Solana in TPS",
  ];

  console.log("🎲 Vox Bet Parser — Test Results\n");
  for (const phrase of testPhrases) {
    const result = parseBetFromTranscript(phrase);
    if (result) {
      console.log(`✅ "${phrase}"`);
      console.log(`   → $${result.amount} | ${result.category} | confidence: ${result.confidence.toFixed(1)}`);
      console.log(`   → condition: "${result.condition}"\n`);
    } else {
      console.log(`❌ "${phrase}" — no bet detected\n`);
    }
  }
}
