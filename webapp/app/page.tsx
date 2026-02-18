"use client";

import { useState } from "react";
import TxTicker from "@/components/TxTicker";
import BetBoard from "@/components/BetBoard";
import Leaderboard from "@/components/Leaderboard";
import Stats from "@/components/Stats";
import HowItWorks from "@/components/HowItWorks";
import SpeedChart from "@/components/SpeedChart";
import { CONTRACTS, explorerAddress } from "@/lib/monad";
import type { Transaction, Bet, LeaderboardEntry, Stats as StatsType } from "@/lib/types";

// Demo data — will be replaced with real-time data from Monad
const DEMO_TXS: Transaction[] = [
  {
    hash: "0xa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    type: "create",
    betId: "bet-001",
    amount: 250_000,
    from: "0x6B6dd693686db9a31c3db0C3d8f3eE89F398d6fe",
    to: "0x0000000000000000000000000000000000000001",
    timestamp: Date.now() - 5000,
    confirmationMs: 812,
    blockNumber: 1234567,
  },
  {
    hash: "0xb2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678",
    type: "match",
    betId: "bet-001",
    amount: 250_000,
    from: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    to: "0x0000000000000000000000000000000000000001",
    timestamp: Date.now() - 3000,
    confirmationMs: 798,
    blockNumber: 1234568,
  },
  {
    hash: "0xc3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890",
    type: "resolve",
    betId: "bet-001",
    amount: 490_000,
    from: "0x0000000000000000000000000000000000000001",
    to: "0x6B6dd693686db9a31c3db0C3d8f3eE89F398d6fe",
    timestamp: Date.now() - 1000,
    confirmationMs: 805,
    blockNumber: 1234569,
  },
];

const DEMO_BETS: Bet[] = [
  {
    id: "bet-001",
    partyA: "0x6B6dd693686db9a31c3db0C3d8f3eE89F398d6fe",
    partyB: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    amount: 0.25,
    condition: "BTC hits $100K by end of February",
    category: "crypto_price",
    deadline: Date.now() + 86400000,
    status: "resolved",
    winner: "0x6B6dd693686db9a31c3db0C3d8f3eE89F398d6fe",
    createdAt: Date.now() - 60000,
    resolvedAt: Date.now() - 1000,
  },
  {
    id: "bet-002",
    partyA: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    partyB: "0x6B6dd693686db9a31c3db0C3d8f3eE89F398d6fe",
    amount: 0.10,
    condition: "It will rain in Denver tomorrow",
    category: "weather",
    deadline: Date.now() + 86400000,
    status: "active",
    createdAt: Date.now() - 30000,
  },
];

const DEMO_LEADERBOARD: LeaderboardEntry[] = [
  { address: "0x6B6dd693686db9a31c3db0C3d8f3eE89F398d6fe", name: "Vox User 🎙️", wins: 7, losses: 2, totalEarned: 3.20, totalBet: 4.50, streak: 3 },
  { address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", name: "Julio 🚀", wins: 5, losses: 4, totalEarned: 1.80, totalBet: 3.75, streak: 1 },
];

const DEMO_STATS: StatsType = {
  totalBets: 12,
  totalTransactions: 36,
  totalVolume: 8.50,
  avgSettlementMs: 805,
  activeBets: 3,
};

export default function Home() {
  const [transactions] = useState<Transaction[]>(DEMO_TXS);
  const [bets] = useState<Bet[]>(DEMO_BETS);
  const [leaderboard] = useState<LeaderboardEntry[]>(DEMO_LEADERBOARD);
  const [stats] = useState<StatsType>(DEMO_STATS);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header with PerkOS branding */}
      <div className="text-center mb-10">
        <div className="inline-block mb-4 animate-float">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[var(--monad-purple)] to-purple-900 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/20">
            🔮
          </div>
        </div>
        <div className="text-xs font-bold tracking-widest text-[var(--monad-purple-light)] mb-2 uppercase">
          PerkOS presents
        </div>
        <h1 className="text-4xl md:text-6xl font-bold mb-3 bg-gradient-to-r from-white via-[var(--monad-purple-light)] to-white bg-clip-text text-transparent">
          VoiceBet Arena
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto">
          Make bets just by talking. Settled on{" "}
          <span className="text-[var(--monad-purple-light)] font-bold">Monad</span>{" "}
          in <span className="text-green-400 font-bold">800ms</span>.
        </p>

        {/* Contract address */}
        <div className="mt-4">
          <a
            href={explorerAddress(CONTRACTS.ESCROW)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--monad-card)] border border-[var(--monad-border)] text-xs font-mono text-gray-400 hover:text-[var(--monad-purple-light)] hover:border-[var(--monad-purple)] transition-colors"
          >
            📜 Contract: {CONTRACTS.ESCROW.slice(0, 6)}...{CONTRACTS.ESCROW.slice(-4)}
            <span className="text-[10px] text-gray-600">↗</span>
          </a>
        </div>

        {/* Tech stack pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {["🎙️ Omi", "🕸 OmiMesh", "🤖 OpenClaw", "💰 x402", "🟣 Monad"].map((item) => (
            <span key={item} className="px-3 py-1 rounded-full bg-[var(--monad-card)] border border-[var(--monad-border)] text-xs text-gray-400">
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="mb-6">
        <HowItWorks />
      </div>

      {/* Stats */}
      <div className="mb-6">
        <Stats stats={stats} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TxTicker transactions={transactions} />
        <BetBoard bets={bets} />
      </div>

      {/* Leaderboard + Speed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Leaderboard entries={leaderboard} />
        <SpeedChart />
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-sm text-gray-600 pb-8">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-[var(--monad-purple)] to-purple-900 flex items-center justify-center text-[10px]">🔮</div>
          <span className="font-bold text-gray-400">PerkOS</span>
        </div>
        <p>
          Built with 🔮 by{" "}
          <a href="https://perkos.xyz" className="text-[var(--monad-purple-light)] hover:underline">
            PerkOS
          </a>{" "}
          | ETHDenver 2026
        </p>
        <p className="mt-1">
          Powered by Omi × OmiMesh × OpenClaw × PerkOS Stack × Monad
        </p>
      </footer>
    </main>
  );
}
