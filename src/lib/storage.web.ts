import type { AlarmCard } from "@/types/alarm";
import {
  LEGACY_STORAGE_KEY,
  parseStoredCards,
  STORAGE_KEY,
} from "@/lib/storage-core";

export async function readCards(): Promise<AlarmCard[]> {
  if (typeof globalThis.localStorage === "undefined") return [];
  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (raw) return parseStoredCards(raw, "modern");

  const legacyRaw = globalThis.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) return [];

  const migratedCards = parseStoredCards(legacyRaw, "legacy");
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedCards));
  return migratedCards;
}

export async function writeCards(cards: AlarmCard[]): Promise<void> {
  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }
}
