"use client";

import type { Bet } from "@/lib/types";
import { shortenAddress, formatUSDC } from "@/lib/monad";

interface BetBoardProps {
  bets: Bet[];
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  active: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  resolved: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  expired: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const categoryEmoji: Record<string, string> = {
  crypto_price: "🪙",
  weather: "🌤️",
  sports: "⚽",
  trivia: "🧠",
  fun_social: "🎲",
};

export default function BetBoard({ bets }: BetBoardProps) {
  return (
    <div className="rounded-xl border border-[var(--monad-border)] bg-[var(--monad-card)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--monad-border)]">
        <h2 className="text-lg font-bold">🎲 Active Bets</h2>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {bets.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No bets yet — say &quot;I bet...&quot; to start! 🎙️
          </div>
        ) : (
          bets.map((bet) => (
            <div
              key={bet.id}
              className="px-4 py-3 border-b border-[var(--monad-border)] hover:bg-[#1a1a2e]"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{categoryEmoji[bet.category] || "🎲"}</span>
                    <span className="text-sm font-medium">{bet.condition}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {shortenAddress(bet.partyA)} vs {shortenAddress(bet.partyB)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-[var(--monad-purple-light)]">
                    ${(bet.amount * 2).toFixed(2)} pot
                  </div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${statusColors[bet.status]}`}
                  >
                    {bet.status.toUpperCase()}
                  </span>
                  {bet.winner && (
                    <div className="text-xs text-green-400 mt-1">
                      🏆 {shortenAddress(bet.winner)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
