"use client";

import type { LeaderboardEntry } from "@/lib/types";
import { shortenAddress } from "@/lib/monad";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export default function Leaderboard({ entries }: LeaderboardProps) {
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="rounded-xl border border-[var(--monad-border)] bg-[var(--monad-card)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--monad-border)]">
        <h2 className="text-lg font-bold">🏆 Leaderboard</h2>
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No bettors yet
          </div>
        ) : (
          entries.map((entry, i) => (
            <div
              key={entry.address}
              className="px-4 py-3 border-b border-[var(--monad-border)] flex items-center justify-between hover:bg-[#1a1a2e]"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg w-8 text-center">
                  {i < 3 ? medals[i] : `#${i + 1}`}
                </span>
                <div>
                  <div className="text-sm font-medium">
                    {entry.name || shortenAddress(entry.address)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {entry.wins}W - {entry.losses}L
                    {entry.streak > 1 && (
                      <span className="text-orange-400 ml-1">🔥 {entry.streak} streak</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-green-400">
                  +${entry.totalEarned.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  ${entry.totalBet.toFixed(2)} wagered
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
