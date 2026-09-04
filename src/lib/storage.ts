import Storage from "expo-sqlite/kv-store";

import type { AlarmCard } from "@/types/alarm";
import {
  LEGACY_STORAGE_KEY,
  parseStoredCards,
  STORAGE_KEY,
} from "@/lib/storage-core";

export async function readCards(): Promise<AlarmCard[]> {
  const raw = await Storage.getItem(STORAGE_KEY);
  if (raw) return parseStoredCards(raw, "modern");

  const legacyRaw = await Storage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) return [];

  const migratedCards = parseStoredCards(legacyRaw, "legacy");
  await Storage.setItem(STORAGE_KEY, JSON.stringify(migratedCards));
  return migratedCards;
}

export async function writeCards(cards: AlarmCard[]): Promise<void> {
  await Storage.setItem(STORAGE_KEY, JSON.stringify(cards));
}
