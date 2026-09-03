import Storage from "expo-sqlite/kv-store";

import type { AlarmCard } from "@/types/alarm";

const STORAGE_KEY = "alarim.cards.v1";

function isValidCard(value: unknown): value is AlarmCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<AlarmCard>;
  return (
    typeof card.id === "number" &&
    typeof card.note === "string" &&
    Array.isArray(card.times)
  );
}

function normalizeCard(card: AlarmCard): AlarmCard {
  return {
    id: card.id,
    title: card.title ?? "",
    imageUri: card.imageUri ?? null,
    note: card.note ?? "",
    times: card.times.map((time) => ({
      id: time.id,
      cardId: time.cardId || card.id,
      hour: Math.min(23, Math.max(0, time.hour)),
      minute: Math.min(59, Math.max(0, time.minute)),
      repeatDays: [...new Set(time.repeatDays ?? [])].sort((a, b) => a - b),
      soundUri: time.soundUri ?? null,
      soundName: time.soundName ?? null,
      snoozeMinutes: time.snoozeMinutes || 10,
      enabled: time.enabled !== false,
    })),
  };
}

export async function readCards(): Promise<AlarmCard[]> {
  const raw = await Storage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cards: AlarmCard[] = [];
    for (const value of parsed) {
      if (isValidCard(value)) cards.push(normalizeCard(value));
    }
    return cards;
  } catch {
    return [];
  }
}

export async function writeCards(cards: AlarmCard[]): Promise<void> {
  await Storage.setItem(STORAGE_KEY, JSON.stringify(cards));
}
