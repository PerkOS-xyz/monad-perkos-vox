"use client";

const chains = [
  { name: "Monad", time: 0.8, color: "bg-[var(--monad-purple)]", textColor: "text-[var(--monad-purple-light)]", pct: 6.7, highlight: true },
  { name: "Solana", time: 0.4, color: "bg-emerald-600", textColor: "text-gray-400", pct: 3.3, highlight: false },
  { name: "Base", time: 2, color: "bg-blue-700", textColor: "text-gray-400", pct: 16.7, highlight: false },
  { name: "Arbitrum", time: 7, color: "bg-gray-600", textColor: "text-gray-400", pct: 58, highlight: false },
  { name: "Ethereum", time: 12, color: "bg-gray-700", textColor: "text-red-400", pct: 100, highlight: false },
];

export default function SpeedChart() {
  return (
    <div className="rounded-xl border border-[var(--monad-border)] bg-[var(--monad-card)] p-6">
      <h2 className="text-lg font-bold mb-4">⚡ Settlement Speed</h2>
      <div className="space-y-3">
        {chains.map((chain) => (
          <div key={chain.name}>
            <div className="flex justify-between text-sm mb-1">
              <span className={chain.highlight ? "text-[var(--monad-purple-light)] font-bold" : "text-gray-400"}>
                {chain.highlight ? "🟣 " : ""}{chain.name}
              </span>
              <span className={`font-bold ${chain.highlight ? "text-green-400" : chain.textColor}`}>
                {chain.time}s
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
              <div
                className={`${chain.color} h-4 rounded-full animate-bar-fill ${chain.highlight ? "animate-glow-pulse" : ""}`}
                style={{ width: `${Math.max(chain.pct, 4)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-[var(--monad-purple)]/20 border border-[var(--monad-purple)]/40 text-xs text-[var(--monad-purple-light)] font-bold">
          Monad: 10,000 TPS · EVM compatible · Sub-second finality
        </span>
      </div>
    </div>
  );
}
