<div align="center">

# 🎲 PerkOS Vox — VoiceBet Arena

### *"Just say it. Bet it. Settle it. 800ms."*

**Voice-powered micro-betting on Monad.** Two people talk → AI detects *"I bet you $0.10 that..."* → funds lock on-chain in 800ms → AI resolves → winner gets paid. No app. No clicks. Just conversation.

[![Live Demo](https://img.shields.io/badge/🔴_Live_Demo-vox.perkos.xyz-blueviolet?style=for-the-badge)](https://vox.perkos.xyz)
[![Agent API](https://img.shields.io/badge/Agent_API-Online-00C853?style=for-the-badge)](https://agent-vox.perkos.xyz/health)
[![Monad](https://img.shields.io/badge/Monad-Mainnet_(143)-7C3AED?style=for-the-badge)](https://monadscan.com/address/0x0b3b319145543da36E5e9Bf07BF66e67B28260A5)
[![Contract](https://img.shields.io/badge/Contract-Verified-green?style=for-the-badge)](https://monadscan.com/address/0x0b3b319145543da36E5e9Bf07BF66e67B28260A5)

> *"Made 6 bets during lunch. All settled on-chain in 7.5 seconds total. Won $3.20."*

</div>

---

## ⚡ The Problem

Betting between friends is broken: handshake bets are forgotten, Venmo is manual, and on-chain betting is slow and expensive. **What if your voice was the interface?**

## 💡 The Solution

PerkOS Vox turns casual conversation into **trustless, on-chain micro-bets** using an AI wearable, an AI oracle, and Monad's 800ms finality.

---

## 🏗️ Architecture

```
  🎙️ Voice                    🌐 Webhook                 🤖 AI Oracle              ⛓️ On-Chain
┌──────────────┐          ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│              │          │              │          │              │          │              │
│  Omi AI      │  audio   │  OmiMesh     │ transcript│  OpenClaw    │  tx      │  Monad L1    │
│  Wearable    │────────▶ │  Plugin      │────────▶ │  Vox Agent   │────────▶ │  800ms ⚡    │
│              │          │              │          │              │          │              │
│  "I bet $0.10   │          │  Cloudflare  │          │  Parse bet   │          │  VoiceBet    │
│   BTC hits   │          │  Tunnel      │          │  Lock escrow │          │  Escrow.sol  │
│   120K"      │          │              │          │  Resolve     │          │  USDC settle │
│              │          │              │          │  Pay winner  │          │              │
└──────────────┘          └──────────────┘          └──────────────┘          └──────────────┘
                                                           │
                                                    ┌──────┴──────┐
                                                    │  PerkOS x402 │
                                                    │  Payments    │
                                                    └─────────────┘
```

---

## 🎯 How It Works

| Step | What Happens | Time |
|------|-------------|------|
| 1️⃣ **Detect** | Omi wearable hears *"I bet..."* or *"wanna bet?"* | Real-time |
| 2️⃣ **Parse** | Vox AI extracts `{ condition, amount, parties, category, deadline }` | ~200ms |
| 3️⃣ **Lock** | Both parties sign → USDC locks in escrow on Monad | **800ms** ⚡ |
| 4️⃣ **Resolve** | Vox oracle checks condition (API, AI judgment, or mutual confirm) | Auto |
| 5️⃣ **Payout** | Winner receives 2× bet minus 2% fee | **800ms** ⚡ |

**Minimum 3 on-chain txs per bet** (lock A + lock B + payout). Fast bets = lots of visible chain activity 🔥

---

## 📊 Live Demo Results

```
┌─────────────────────────────────────────────────┐
│           🏁 BENCHMARK: 6 BETS                  │
│                                                  │
│   Total time:     7.5 seconds                    │
│   Avg per bet:    1.25s (lock + resolve + pay)   │
│   On-chain txs:   18+                            │
│   Gas cost:       ~$0.03 total                   │
│                                                  │
│   ⚡ vs Ethereum: 10x faster, 4000x cheaper      │
│   ⚡ vs Solana:   Comparable speed, true L1       │
└─────────────────────────────────────────────────┘
```

| Metric | Monad (Vox) | Ethereum | Improvement |
|--------|-------------|----------|-------------|
| Finality | 800ms | ~12 min | **900×** |
| 6 bets settled | 7.5s | ~72 min | **576×** |
| Gas for 6 bets | ~$0.03 | ~$120 | **4,000×** |

---

## 🛠️ Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Voice Capture** | [Omi AI Wearable](https://omi.me) | Always-on voice → transcript |
| **Plugin Bridge** | [OmiMesh](https://github.com/PerkOS-xyz/OmiMesh) | Webhook relay to OpenClaw |
| **AI Oracle** | [OpenClaw](https://docs.openclaw.ai) | Bet parsing, resolution, tx execution |
| **Payments** | [PerkOS Stack](https://stack.perkos.xyz) (x402) | Micropayment facilitation |
| **Settlement** | [Monad](https://monad.xyz) (Chain 143) | 10K TPS, 800ms finality, USDC escrow |
| **Dashboard** | Next.js + Tailwind | Real-time bet feed & leaderboard |

---

## 📜 Smart Contract — `VoiceBetEscrow.sol`

Deployed on **Monad Mainnet** • [View on Monadscan →](https://monadscan.com/address/0x0b3b319145543da36E5e9Bf07BF66e67B28260A5)

```solidity
// Core features
- 5 bet categories: crypto_price, weather, sports, trivia, fun_social
- Bet range: $0.01 – $1.00 (USDC, 6 decimals)
- 2% platform fee (200 bps), max 5%
- ReentrancyGuard + SafeERC20
- Oracle-resolved or auto-expire with refund
- On-chain stats: totalBets, totalVolume, totalResolved
```

| Contract | Address | Network |
|----------|---------|---------|
| **VoiceBetEscrow** | [`0x0b3b319145543da36E5e9Bf07BF66e67B28260A5`](https://monadscan.com/address/0x0b3b319145543da36E5e9Bf07BF66e67B28260A5) | Monad (143) |
| **USDC** (Circle CCTP) | [`0x754704Bc059F8C67012fEd69BC8A327a5aafb603`](https://monadscan.com/address/0x754704Bc059F8C67012fEd69BC8A327a5aafb603) | Monad (143) |

### 📋 Bet Categories

| Category | Example | Resolution |
|----------|---------|------------|
| 🪙 Crypto Price | *"BTC above 100K by Friday"* | Price API (auto) |
| 🌤️ Weather | *"It'll rain in Denver tomorrow"* | Weather API (auto) |
| ⚽ Sports | *"Lakers win tonight"* | Sports API (auto) |
| 🧠 Trivia | *"Capital of Mongolia?"* | AI instant resolve |
| 🎲 Fun/Social | *"You can't do 20 pushups"* | Voice confirmation |

---

## 📁 Project Structure

```
Monad-Denver-2026/
├── contracts/                      # Foundry — Monad smart contracts
│   ├── src/VoiceBetEscrow.sol      # Escrow contract (12/12 tests ✅)
│   ├── test/VoiceBetEscrow.t.sol   # Full test suite
│   ├── script/Deploy.s.sol         # Deployment script
│   └── foundry.toml
├── agent/                          # Vox — OpenClaw AI agent
│   ├── SOUL.md                     # Agent persona & rules
│   ├── bet-parser.ts               # Intent detection + structuring
│   ├── oracle.ts                   # Resolution logic (APIs + AI)
│   └── x402-pay.ts                 # PerkOS x402 payment integration
├── webapp/                         # Next.js dashboard
│   ├── app/page.tsx                # Main dashboard
│   ├── components/
│   │   ├── TxTicker.tsx            # Live Monad tx feed
│   │   ├── BetBoard.tsx            # Active bets board
│   │   ├── Leaderboard.tsx         # Player rankings
│   │   └── Stats.tsx               # Volume & speed stats
│   └── lib/monad.ts                # RPC + contract interaction
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+, pnpm
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)
- Monad RPC: `https://rpc.monad.xyz`

### 1. Clone & Install

```bash
git clone https://github.com/PerkOS-xyz/Monad-Denver-2026.git
cd Monad-Denver-2026
```

### 2. Smart Contracts

```bash
cd contracts
forge install
forge test          # 12/12 tests passing ✅
forge build
```

### 3. Web Dashboard

```bash
cd webapp
pnpm install
cp .env.example .env.local    # Add your RPC & contract addresses
pnpm dev                      # http://localhost:3000
```

### 4. Agent (OpenClaw)

```bash
cd agent
# Configure SOUL.md with your OpenClaw gateway
# Start via OpenClaw CLI
openclaw gateway start
```

### Environment Variables

```env
NEXT_PUBLIC_MONAD_RPC=https://rpc.monad.xyz
NEXT_PUBLIC_ESCROW_ADDRESS=0x0b3b319145543da36E5e9Bf07BF66e67B28260A5
NEXT_PUBLIC_USDC_ADDRESS=0x754704Bc059F8C67012fEd69BC8A327a5aafb603
NEXT_PUBLIC_CHAIN_ID=143
```

---

## 🌍 Live Deployment

> **Everything is live and running.** Voice a bet → watch it land on-chain.

| Service | URL | Stack |
|---------|-----|-------|
| 🔴 **Live Demo** | [vox.perkos.xyz](https://vox.perkos.xyz) | Next.js static export → Netlify (auto-deploy) |
| 🤖 **Agent API** | [agent-vox.perkos.xyz](https://agent-vox.perkos.xyz/health) | Node.js + Express on AWS |
| ⛓️ **Contract** | [Monadscan](https://monadscan.com/address/0x0b3b319145543da36E5e9Bf07BF66e67B28260A5) | Monad Mainnet (143) |

### Agent API Endpoints

```
POST /webhook/transcript   ← OmiMesh sends voice transcripts here
GET  /health               ← Service health check
GET  /bets                 ← List all detected/processed bets
```

### Infrastructure

| Component | Details |
|-----------|---------|
| **AWS VPS** | `t3.medium` · Ubuntu 24.04 · nginx reverse proxy · systemd service |
| **Netlify** | Static export auto-deployed from `webapp/out` on push |
| **Agent Service** | Accepts OmiMesh webhook payloads, auto-detects bets from voice transcripts |

### 🧪 Tested End-to-End

```
🎙️ "I bet you $0.10 that Bitcoin hits 120K by Friday"
       ↓
🤖 Parsed → { amount: 0.10, condition: "BTC hits 120K", 
               category: "crypto_price", deadline: "Friday" }
       ↓
⛓️ Escrow locked on Monad in 800ms ⚡
```

---

## 🟣 Monad Network Details

| Field | Value |
|-------|-------|
| Chain ID | `143` |
| RPC | `https://rpc.monad.xyz` |
| Block Time | 400ms |
| Finality | **800ms** |
| TPS | **10,000** |
| Explorer | [monadscan.com](https://monadscan.com) |
| USDC | Circle CCTP (EIP-3009 ✅) |

---

## 👥 Team

| | Name | Role |
|---|------|------|
| 🧑‍💻 | **Julio M Cruz** | Founder, PerkOS · Smart contracts · Architecture · Agent development |

**PerkOS** — Building the micropayment layer for AI agents and voice interfaces.

---

## 🔗 Links

| | Link |
|---|------|
| 🌐 **Live Demo** | [vox.perkos.xyz](https://vox.perkos.xyz) |
| 🤖 **Agent API** | [agent-vox.perkos.xyz](https://agent-vox.perkos.xyz/health) |
| 📦 **GitHub** | [github.com/PerkOS-xyz/Monad-Denver-2026](https://github.com/PerkOS-xyz/Monad-Denver-2026) |
| 📜 **Contract** | [Monadscan](https://monadscan.com/address/0x0b3b319145543da36E5e9Bf07BF66e67B28260A5) |
| 🛠️ **PerkOS Stack** | [stack.perkos.xyz](https://stack.perkos.xyz) |
| 🕸️ **OmiMesh** | [github.com/PerkOS-xyz/OmiMesh](https://github.com/PerkOS-xyz/OmiMesh) |
| 🤖 **OpenClaw** | [docs.openclaw.ai](https://docs.openclaw.ai) |
| 🎧 **Omi Wearable** | [omi.me](https://omi.me) |

---

<div align="center">

**Built with 🔮 by [PerkOS](https://perkos.xyz) | ETHDenver 2026**

*Where conversations become on-chain commitments.*

</div>