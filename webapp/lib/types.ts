export type BetStatus = "pending" | "active" | "resolved" | "cancelled" | "expired";
export type BetCategory = "crypto_price" | "weather" | "sports" | "trivia" | "fun_social";

export interface Bet {
  id: string;
  partyA: string;
  partyB: string;
  amount: number;       // in USD
  condition: string;
  category: BetCategory;
  deadline: number;     // unix timestamp
  status: BetStatus;
  winner?: string;
  createdAt: number;
  resolvedAt?: number;
  txHash?: string;
  matchTxHash?: string;
  resolveTxHash?: string;
}

export interface Transaction {
  hash: string;
  type: "create" | "match" | "resolve" | "cancel";
  betId: string;
  amount: number;
  from: string;
  to: string;
  timestamp: number;
  confirmationMs: number;  // settlement time in ms
  blockNumber: number;
}

export interface LeaderboardEntry {
  address: string;
  name?: string;
  wins: number;
  losses: number;
  totalEarned: number;
  totalBet: number;
  streak: number;
}

export interface Stats {
  totalBets: number;
  totalTransactions: number;
  totalVolume: number;
  avgSettlementMs: number;
  activeBets: number;
}
