import type { AlarmCard } from "@/types/alarm";

const STORAGE_KEY = "alarim.cards.v1";

export async function readCards(): Promise<AlarmCard[]> {
  if (typeof globalThis.localStorage === "undefined") return [];
  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AlarmCard[]) : [];
  } catch {
    return [];
  }
}

export async function writeCards(cards: AlarmCard[]): Promise<void> {
  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }
}
