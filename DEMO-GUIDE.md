# 🎲 PerkOS Vox — Demo Workflow Guide

> **ETHDenver 2026 — Complete end-to-end demo instructions for judges**

---

## 🔍 Honest Status Assessment

Before the demo script, here's what **actually works** vs what's **still TODO**:

### ✅ Working Now
- **Smart contract** — `VoiceBetEscrow` deployed and verified on Monad mainnet (chain 143) at `0x0b3b319145543da36E5e9Bf07BF66e67B28260A5`
- **Bet parser** — Regex-based NLP that extracts bets from natural language (works well for common phrases)
- **On-chain lifecycle** — `createBet → matchBet → resolveBet` all work via `x402-pay.ts` using viem
- **Oracle** — CoinGecko (crypto prices) and wttr.in (weather) integrations functional
- **Dashboard UI** — Beautiful Next.js app deployed at https://vox.perkos.xyz
- **Test workflow** — `test-workflow.ts` creates real on-chain bets and cancels them (proven working)

### ⚠️ Gaps / TODO (Critical for Live Demo)
1. **No HTTP server in the repo** — The `agent/` directory has standalone scripts (`bet-parser.ts`, `oracle.ts`, `x402-pay.ts`, `test-workflow.ts`) but **no Express/Fastify server** that exposes `/webhook/transcript`, `/health`, `/bets`, or the OmiMesh endpoints. The VPS reportedly runs a `vox-agent` systemd service on port 3000, but that server code isn't in this repo. **This is the biggest gap.**
2. **Dashboard uses hardcoded demo data** — `webapp/app/page.tsx` uses `DEMO_TXS`, `DEMO_BETS`, `DEMO_LEADERBOARD`, `DEMO_STATS` constants. It does NOT fetch from the agent API or read from Monad. No WebSocket/polling for real-time updates.
3. **No webhook-to-chain bridge** — Even if the HTTP server exists on the VPS, the code to go from "received transcript webhook" → "call bet-parser" → "call createBet on-chain" isn't wired up in this repo.
4. **Single wallet limitation** — `test-workflow.ts` acknowledges only one funded wallet exists. A real bet needs two parties (partyA creates, partyB matches). The demo creates and immediately cancels.
5. **Omi webhook URL needs HTTPS** — The VPS currently serves HTTP on port 80. Omi requires HTTPS webhooks.
6. **Oracle → on-chain resolution not automated** — `oracle.ts` resolves off-chain (returns a result), but there's no automation loop that calls `resolveBet` on-chain with the oracle result.

### 🎯 What Needs Building for a Real Live Demo
| Priority | Task | Effort |
|----------|------|--------|
| **P0** | Build HTTP server with webhook endpoints | 2-3 hours |
| **P0** | Wire webhook → bet-parser → createBet pipeline | 1-2 hours |
| **P0** | Set up HTTPS (see SSL section below) | 30 min |
| **P1** | Dashboard fetches real data from agent API or chain | 2-3 hours |
| **P1** | Auto-match bets (agent acts as partyB for demo) | 1 hour |
| **P2** | Oracle auto-resolution loop | 1-2 hours |
| **P2** | WebSocket for real-time dashboard updates | 1-2 hours |

---

## ✅ Pre-Demo Checklist

### Services to Have Running
- [ ] **VPS agent server** — `ssh ubuntu@<SERVER_IP>` → `sudo systemctl status vox-agent` (should be active on port 3000)
- [ ] **Nginx** — `sudo systemctl status nginx` (reverse proxy port 80/443 → 3000)
- [ ] **HTTPS certificate** — Valid SSL cert (see setup below)
- [ ] **Omi device** — Charged, paired with phone, webhook URL configured
- [ ] **USDC balance** — Check agent wallet has USDC: `npx tsx test-workflow.ts` or curl `/health`

### Browser Tabs to Have Open
1. **Dashboard** — https://vox.perkos.xyz
2. **Monadscan contract** — https://monadscan.com/address/0x0b3b319145543da36E5e9Bf07BF66e67B28260A5
3. **Agent health** — `https://<YOUR_DOMAIN>/health`
4. **Terminal** — SSH'd into VPS watching logs: `sudo journalctl -u vox-agent -f`

### Quick Verification (5 min before demo)
```bash
# 1. Health check
curl https://<YOUR_DOMAIN>/health

# 2. Test bet parsing
curl -X POST https://<YOUR_DOMAIN>/webhook/transcript \
  -H "Content-Type: application/json" \
  -d '{"segments": [{"text": "I bet you $0.10 that Bitcoin hits 120K by Friday", "speaker": "user", "is_user": true}]}'

# 3. Check existing bets
curl https://<YOUR_DOMAIN>/bets
```

---

## 🔒 SSL/HTTPS Setup

Omi wearable requires HTTPS webhook URLs. Two options:

### Option A: Custom Domain + Let's Encrypt (Recommended)

**1. Point a domain to the VPS:**
- Buy a domain or use a free subdomain service like [FreeDNS](https://freedns.afraid.org/), [DuckDNS](https://www.duckdns.org/), or [No-IP](https://www.noip.com/)
- Create an A record pointing to `<SERVER_IP>`
- Example: `vox.yourdomain.com → <SERVER_IP>`

**2. Install certbot on the VPS:**
```bash
ssh ubuntu@<SERVER_IP>

# Install certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d vox.yourdomain.com \
  --non-interactive --agree-tos \
  -m julio.cruz@eb-ms.net

# Verify auto-renewal
sudo certbot renew --dry-run
```

**3. Nginx config** (`/etc/nginx/sites-available/default`):
```nginx
server {
    listen 80;
    server_name vox.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name vox.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/vox.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vox.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Option B: Cloudflare Tunnel (No Domain Needed)

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Quick tunnel (gives you a random *.trycloudflare.com URL)
cloudflared tunnel --url http://localhost:3000

# Output: Your tunnel URL is https://random-words.trycloudflare.com
# Use this URL for Omi webhook config
```

> ⚠️ The Cloudflare tunnel URL changes each time you restart. For a stable URL, set up a named tunnel with a Cloudflare account (free).

---

## 📱 Omi Device Configuration

1. Open the **Omi app** on your phone
2. Go to **Settings → Plugins/Integrations → Webhooks**
3. Set the webhook URL:
   - With custom domain: `https://vox.yourdomain.com/webhook/transcript`
   - With Cloudflare tunnel: `https://random-words.trycloudflare.com/webhook/transcript`
   - For OmiMesh integration: use `/omimesh/transcript` endpoint instead
4. Set webhook type to **Transcript** (sends text segments as they're processed)
5. Ensure the Omi device is paired via Bluetooth and the app shows "Connected"

### OmiMesh Plugin (Alternative)
If using OmiMesh memory processing instead of raw transcripts:
- Configure memory webhook: `https://<YOUR_DOMAIN>/omimesh/memory`
- This sends structured memory payloads with `transcript_segments` and `structured.overview`

---

## 🎬 Step-by-Step Demo Script

### Setup (30 seconds)
1. Put on the Omi wearable (make sure it's on and connected)
2. Open laptop with dashboard tab visible to judges
3. Open terminal showing agent logs in a small window

### The Pitch (30 seconds)
> "PerkOS Vox turns conversation into on-chain bets. I'm wearing an AI wearable that listens to my voice. When I say 'I bet...', it captures it, parses the bet, locks USDC in escrow on Monad, and settles in under a second. Watch."

### The Demo (60-90 seconds)

**Beat 1 — Voice Bet** (15s)
> *Speaking naturally:* "I bet you fifty cents that Bitcoin hits 120K by Friday"

*Point to terminal:* "The Omi wearable just captured that, sent it to our agent, which parsed the bet — fifty cents, crypto price category, deadline Friday."

**Beat 2 — On-Chain** (15s)
*Point to Monadscan tab:* "There's the transaction — USDC is now locked in our escrow contract on Monad. That took 800 milliseconds."

**Beat 3 — Dashboard** (15s)
*Point to dashboard:* "The bet shows up here in real-time. Both parties can see the condition, amount, and status."

**Beat 4 — Resolution** (15s)
> "Our AI oracle checks external APIs — CoinGecko for crypto prices, weather APIs, or uses AI judgment for trivia. When the condition is met, it resolves on-chain and the winner gets paid automatically."

**Beat 5 — Speed** (10s)
> "That entire flow — voice to chain to settlement — takes about 2 seconds on Monad. On Ethereum that would be minutes. That's what makes micro-betting practical."

### Closing (15 seconds)
> "PerkOS Vox: just say it, bet it, settle it. 800 milliseconds. Built on Monad."

---

## 🔄 Fallback Plan (If Omi Has Issues)

If the Omi device isn't working, use curl to simulate the exact same flow:

### Simulate Voice Transcript
```bash
# Simulate what Omi sends to the webhook
curl -X POST https://<YOUR_DOMAIN>/webhook/transcript \
  -H "Content-Type: application/json" \
  -d '{
    "segments": [
      {
        "text": "I bet you $0.50 that Bitcoin hits 120K by Friday",
        "speaker": "user",
        "speaker_id": 0,
        "is_user": true,
        "start": 0.0,
        "end": 3.5
      }
    ],
    "session_id": "demo-001"
  }'
```

### Simulate OmiMesh Memory
```bash
curl -X POST https://<YOUR_DOMAIN>/omimesh/memory \
  -H "Content-Type: application/json" \
  -d '{
    "transcript_segments": [
      {
        "text": "I bet you $0.50 that Bitcoin hits 120K by Friday",
        "speaker": "SPEAKER_0",
        "is_user": true
      }
    ],
    "structured": {
      "title": "Crypto bet discussion",
      "overview": "User made a $0.50 bet that Bitcoin will reach 120K by Friday"
    }
  }'
```

### Direct On-Chain Test (Bypass Server Entirely)
```bash
cd /path/to/Monad-Denver-2026/agent
PRIVATE_KEY=<your-key> npx tsx test-workflow.ts
```

This creates real on-chain bets, shows transaction hashes and settlement times, then cancels them to refund USDC.

### Manual Bet Parser Test
```bash
cd /path/to/Monad-Denver-2026/agent
npx tsx bet-parser.ts
```

### Manual Oracle Test
```bash
cd /path/to/Monad-Denver-2026/agent
npx tsx oracle.ts
```

---

## 🛠️ Troubleshooting

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| Omi not sending webhooks | Check Omi app → Webhook settings | Verify URL is HTTPS and reachable; test with `curl` first |
| Agent server not responding | `sudo systemctl status vox-agent` | `sudo systemctl restart vox-agent` then check `journalctl -u vox-agent -f` |
| SSL certificate errors | `curl -v https://<YOUR_DOMAIN>/health` | Re-run `sudo certbot --nginx -d <domain>` |
| "PRIVATE_KEY env var required" | Missing env var on VPS | Check `/etc/systemd/system/vox-agent.service` has `Environment=PRIVATE_KEY=...` or uses an env file |
| USDC balance too low | `curl /health` should show balance | Transfer USDC to agent wallet on Monad |
| Nginx 502 Bad Gateway | Agent server crashed | `sudo systemctl restart vox-agent` |
| Cloudflare tunnel disconnected | Tunnel process died | Re-run `cloudflared tunnel --url http://localhost:3000` |
| Bet parser not detecting bet | Phrasing doesn't match patterns | Use trigger phrases: "I bet you $X that...", "bet $X on...", "$X says..." |
| Transaction reverts | Likely insufficient USDC or approval | Check USDC balance and allowance for escrow contract |
| Dashboard shows demo data | Expected — dashboard uses hardcoded data | This is a known limitation (see Status Assessment above) |

---

## 📡 API Endpoints Reference

### `GET /health`
Health check and system status.

```bash
curl https://<YOUR_DOMAIN>/health
```

**Expected response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "chain": "monad-mainnet",
  "chainId": 143,
  "contract": "0x0b3b319145543da36E5e9Bf07BF66e67B28260A5",
  "uptime": 3600
}
```

### `POST /webhook/transcript`
Receives Omi voice transcript webhooks.

```bash
curl -X POST https://<YOUR_DOMAIN>/webhook/transcript \
  -H "Content-Type: application/json" \
  -d '{
    "segments": [
      {
        "text": "I bet you $0.25 that it rains tomorrow in Denver",
        "speaker": "user",
        "is_user": true
      }
    ]
  }'
```

**Expected response:**
```json
{
  "success": true,
  "bets_detected": 1,
  "bets": [
    {
      "condition": "it rains tomorrow in Denver",
      "amount": 0.25,
      "category": "weather",
      "confidence": 0.7,
      "txHash": "0x...",
      "status": "created"
    }
  ]
}
```

### `GET /bets`
List all detected/created bets.

```bash
curl https://<YOUR_DOMAIN>/bets
```

**Expected response:**
```json
{
  "bets": [
    {
      "id": "0x...",
      "condition": "Bitcoin hits 120K by Friday",
      "amount": 0.50,
      "category": "crypto_price",
      "status": "pending",
      "txHash": "0x...",
      "createdAt": 1739836200
    }
  ]
}
```

### `POST /omimesh/transcript`
OmiMesh real-time transcript endpoint.

```bash
curl -X POST https://<YOUR_DOMAIN>/omimesh/transcript \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I bet you a dollar that Monad is faster than Solana",
    "speaker": "SPEAKER_0",
    "is_user": true,
    "timestamp": 1739836200
  }'
```

### `POST /omimesh/memory`
OmiMesh processed memory endpoint (structured data).

```bash
curl -X POST https://<YOUR_DOMAIN>/omimesh/memory \
  -H "Content-Type: application/json" \
  -d '{
    "transcript_segments": [
      {"text": "I bet you $0.50 that Bitcoin hits 120K", "speaker": "SPEAKER_0", "is_user": true}
    ],
    "structured": {
      "title": "Crypto price bet",
      "overview": "User bet $0.50 on Bitcoin reaching 120K"
    }
  }'
```

### `GET /omimesh/status`
OmiMesh integration status.

```bash
curl https://<YOUR_DOMAIN>/omimesh/status
```

---

## 📋 Key Information Quick Reference

| Item | Value |
|------|-------|
| **VPS IP** | `<SERVER_IP>` (t3.medium, Ubuntu 24.04) |
| **Agent Port** | 3000 (behind nginx) |
| **Systemd Service** | `vox-agent` |
| **Dashboard** | https://vox.perkos.xyz |
| **Chain** | Monad Mainnet (ID: 143) |
| **RPC** | https://rpc.monad.xyz |
| **Explorer** | https://monadscan.com |
| **Escrow Contract** | `0x0b3b319145543da36E5e9Bf07BF66e67B28260A5` |
| **USDC Contract** | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |
| **Currency** | MON (native) + USDC (bets) |

---

*Last updated: February 17, 2026*
