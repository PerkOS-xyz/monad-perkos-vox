import { defineChain } from "viem";

export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monadscan", url: "https://monadscan.com" } },
});

export const CONTRACTS = {
  ESCROW: "0x0b3b319145543da36E5e9Bf07BF66e67B28260A5" as `0x${string}`,
  USDC: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" as `0x${string}`,
};

export const ESCROW_ABI = [
  {
    name: "createBet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "betId", type: "bytes32" },
      { name: "partyB", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "condition", type: "string" },
      { name: "category", type: "string" },
      { name: "deadline", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "matchBet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "betId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "resolveBet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "betId", type: "bytes32" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "cancelBet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "betId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "getBet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "betId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "bytes32" },
          { name: "partyA", type: "address" },
          { name: "partyB", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "condition", type: "string" },
          { name: "category", type: "string" },
          { name: "deadline", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "winner", type: "address" },
          { name: "createdAt", type: "uint64" },
          { name: "resolvedAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    name: "getStats",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_totalBets", type: "uint256" },
      { name: "_totalVolume", type: "uint256" },
      { name: "_totalResolved", type: "uint256" },
    ],
  },
  {
    name: "BetCreated",
    type: "event",
    inputs: [
      { name: "betId", type: "bytes32", indexed: true },
      { name: "partyA", type: "address", indexed: true },
      { name: "partyB", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "condition", type: "string", indexed: false },
      { name: "category", type: "string", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
    ],
  },
  {
    name: "BetResolved",
    type: "event",
    inputs: [
      { name: "betId", type: "bytes32", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
