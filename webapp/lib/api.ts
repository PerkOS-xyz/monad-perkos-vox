const API_URL =
  (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "https://agent-vox.perkos.xyz";

export interface HealthResponse {
  status: string;
  uptime: number;
  betsDetected: number;
}

export interface ApiBet {
  id?: string;
  bettor?: string;
  condition?: string;
  amount?: number;
  category?: string;
  status?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export interface BetsResponse {
  count: number;
  bets: ApiBet[];
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Health API ${res.status}`);
  return res.json();
}

export async function fetchBets(): Promise<BetsResponse> {
  const res = await fetch(`${API_URL}/bets`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Bets API ${res.status}`);
  return res.json();
}
