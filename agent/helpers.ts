import { privateKeyToAccount } from "viem/accounts";

export function getAccount() {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error("PRIVATE_KEY env var required");
  return privateKeyToAccount(key.startsWith("0x") ? key as `0x${string}` : `0x${key}`);
}
