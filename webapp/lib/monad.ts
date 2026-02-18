// Monad chain config — no heavy deps for client-side
export const MONAD_CHAIN = {
  id: 143,
  name: "Monad",
  rpc: "https://rpc.monad.xyz",
  explorer: "https://monadscan.com",
  currency: "MON",
};

export const CONTRACTS = {
  USDC: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
  ESCROW: process.env.NEXT_PUBLIC_ESCROW_ADDRESS || "0x0b3b319145543da36E5e9Bf07BF66e67B28260A5",
};

export function explorerTx(hash: string): string {
  return `${MONAD_CHAIN.explorer}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${MONAD_CHAIN.explorer}/address/${address}`;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUSDC(amount: number): string {
  return `$${(amount / 1_000_000).toFixed(2)}`;
}
