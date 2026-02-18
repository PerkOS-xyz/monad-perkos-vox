"use client";

import { useState, useEffect } from "react";
import type { Transaction } from "@/lib/types";
import { explorerTx, shortenAddress, formatUSDC } from "@/lib/monad";

interface TxTickerProps {
  transactions: Transaction[];
}

const typeEmoji: Record<string, string> = {
  create: "🎲",
  match: "🤝",
  resolve: "💰",
  cancel: "❌",
};

const typeLabel: Record<string, string> = {
  create: "BET CREATED",
  match: "BET MATCHED",
  resolve: "PAYOUT",
  cancel: "CANCELLED",
};

export default function TxTicker({ transactions }: TxTickerProps) {
  return (
    <div className="rounded-xl border border-[var(--monad-border)] bg-[var(--monad-card)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--monad-border)] flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          ⚡ Live Monad Transactions
        </h2>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-400">LIVE</span>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Waiting for bets... 🎙️ Start talking!
          </div>
        ) : (
          transactions.map((tx, i) => (
            <div
              key={tx.hash + i}
              className="px-4 py-3 border-b border-[var(--monad-border)] hover:bg-[#1a1a2e] animate-slide-in"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{typeEmoji[tx.type]}</span>
                  <div>
                    <div className="text-sm font-medium">
                      {typeLabel[tx.type]}
                      <span className="text-[var(--monad-purple-light)] ml-2">
                        {formatUSDC(tx.amount)}
                      </span>
                    </div>
                    <a
                      href={explorerTx(tx.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[var(--monad-purple-light)] font-mono"
                    >
                      {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}
                    </a>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-400">
                    {tx.confirmationMs}ms ✅
                  </div>
                  <div className="text-xs text-gray-500">
                    Block #{tx.blockNumber}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
