"use client";

import type { Stats as StatsType } from "@/lib/types";

interface StatsProps {
  stats: StatsType;
}

export default function Stats({ stats }: StatsProps) {
  const cards = [
    { label: "Total Bets", value: stats.totalBets.toString(), emoji: "🎲" },
    { label: "Transactions", value: stats.totalTransactions.toString(), emoji: "⚡" },
    { label: "Volume", value: `$${stats.totalVolume.toFixed(2)}`, emoji: "💰" },
    { label: "Avg Settlement", value: `${stats.avgSettlementMs}ms`, emoji: "🟣", highlight: true },
    { label: "Active Bets", value: stats.activeBets.toString(), emoji: "🔥" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border bg-[var(--monad-card)] p-4 text-center ${
            card.highlight
              ? "border-[var(--monad-purple)] shadow-lg shadow-purple-500/10"
              : "border-[var(--monad-border)]"
          }`}
        >
          <div className="text-2xl mb-1">{card.emoji}</div>
          <div
            className={`text-xl font-bold ${
              card.highlight ? "text-[var(--monad-purple-light)]" : "text-white"
            }`}
          >
            {card.value}
          </div>
          <div className="text-xs text-gray-500 mt-1">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
