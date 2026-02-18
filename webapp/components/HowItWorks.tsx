"use client";

const steps = [
  { emoji: "🎙️", label: "Voice", desc: "Say your bet out loud" },
  { emoji: "🧠", label: "Omi Wearable", desc: "Captures & streams audio" },
  { emoji: "🤖", label: "AI Parser", desc: "OpenClaw extracts bet details" },
  { emoji: "📜", label: "Smart Contract", desc: "Escrow on Monad (800ms)" },
  { emoji: "💸", label: "Payout", desc: "Winner paid automatically" },
];

export default function HowItWorks() {
  return (
    <div className="rounded-xl border border-[var(--monad-border)] bg-[var(--monad-card)] p-6">
      <h2 className="text-lg font-bold mb-6 text-center">🔮 How It Works</h2>
      <div className="flex flex-col md:flex-row items-center justify-between gap-2 md:gap-0">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2 md:gap-0 md:flex-col">
            <div className="flex items-center md:flex-col gap-2">
              <div
                className="w-14 h-14 rounded-full bg-[var(--monad-purple)]/20 border border-[var(--monad-purple)]/40 flex items-center justify-center text-2xl animate-fade-up"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {step.emoji}
              </div>
              <div className="md:text-center">
                <div className="text-sm font-bold mt-0 md:mt-2">{step.label}</div>
                <div className="text-xs text-gray-500">{step.desc}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <span className="hidden md:block text-[var(--monad-purple-light)] text-xl mx-2">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
