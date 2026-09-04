import {
  getDefaultOnceDate,
  SNOOZE_OPTIONS,
  type AlarmCard,
  type AlarmSchedule,
  type AlarmTime,
  type IsoWeekday,
} from "@/types/alarm";

export const STORAGE_KEY = "alarim.cards.v2";
export const LEGACY_STORAGE_KEY = "alarim.cards.v1";

export const MAX_GROUP_TITLE_LENGTH = 80;
export const MAX_ALARM_TITLE_LENGTH = 80;
export const MAX_NOTE_LENGTH = 500;
export const MAX_URI_LENGTH = 5_000_000;
const MAX_ID = 2_000_000_000;

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function isSafeId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_ID;
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function textValue(value: unknown, maximum: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maximum);
}

function mediaUri(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_URI_LENGTH) return null;
  if (value.trim() !== value || /[\u0000-\u001f\u007f\s]/.test(value)) return null;

  const isAllowedUri = /^(?:(?:file|content|ph|assets-library):\/\/.+|blob:.+|data:(?:image|audio)\/[a-z0-9.+-]+;[^,]*,.+|https?:\/\/.+)$/i;
  return isAllowedUri.test(value) ? value : null;
}

function repeatDays(value: unknown): IsoWeekday[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)].filter(
    (day): day is IsoWeekday =>
      typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 7,
  ).sort((left, right) => left - right);
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1970 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function scheduleValue(value: unknown): AlarmSchedule | null {
  const record = asRecord(value);
  if (!record || (record.type !== "weekly" && record.type !== "once")) return null;

  if (record.type === "weekly") {
    const days = repeatDays(record.repeatDays);
    return days.length > 0 ? { type: "weekly", repeatDays: days } : null;
  }

  return isValidDateKey(record.date) ? { type: "once", date: record.date } : null;
}

function normalizeSnooze(value: unknown): number {
  return SNOOZE_OPTIONS.includes(value as (typeof SNOOZE_OPTIONS)[number])
    ? (value as number)
    : 10;
}

function allocateId(value: unknown, used: Set<number>, nextId: { value: number }): number {
  if (isSafeId(value) && !used.has(value)) {
    used.add(value);
    nextId.value = Math.max(nextId.value, value + 1);
    return value;
  }

  while (used.has(nextId.value)) nextId.value += 1;
  const allocated = nextId.value;
  used.add(allocated);
  nextId.value += 1;
  return allocated;
}

function normalizeModernTime(
  value: unknown,
  cardId: number,
  timeId: number,
): AlarmTime | null {
  const record = asRecord(value);
  const schedule = scheduleValue(record?.schedule);
  if (!record || !schedule) return null;

  return {
    id: timeId,
    cardId,
    title: textValue(record.title, MAX_ALARM_TITLE_LENGTH),
    note: textValue(record.note, MAX_NOTE_LENGTH),
    imageUri: mediaUri(record.imageUri),
    hour: clamp(record.hour, 0, 23, 8),
    minute: clamp(record.minute, 0, 59, 0),
    schedule,
    soundUri: mediaUri(record.soundUri),
    soundName: textValue(record.soundName, 160) || null,
    snoozeMinutes: normalizeSnooze(record.snoozeMinutes),
    enabled: record.enabled !== false,
  };
}

function normalizeLegacyTime(
  value: unknown,
  cardId: number,
  cardTitle: string,
  cardNote: string,
  cardImageUri: string | null,
  timeId: number,
  now: Date,
): AlarmTime | null {
  const record = asRecord(value);
  if (!record) return null;

  const hour = clamp(record.hour, 0, 23, 8);
  const minute = clamp(record.minute, 0, 59, 0);
  const days = repeatDays(record.repeatDays);
  const schedule: AlarmSchedule = days.length > 0
    ? { type: "weekly", repeatDays: days }
    : { type: "once", date: getDefaultOnceDate(hour, minute, now) };

  return {
    id: timeId,
    cardId,
    title: textValue(record.title, MAX_ALARM_TITLE_LENGTH) || cardTitle,
    note: textValue(record.note, MAX_NOTE_LENGTH) || cardNote,
    imageUri: mediaUri(record.imageUri) ?? cardImageUri,
    hour,
    minute,
    schedule,
    soundUri: mediaUri(record.soundUri),
    soundName: textValue(record.soundName, 160) || null,
    snoozeMinutes: normalizeSnooze(record.snoozeMinutes),
    enabled: record.enabled !== false,
  };
}

export function parseStoredCards(
  raw: string,
  mode: "modern" | "legacy",
  now = new Date(),
): AlarmCard[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const cards: AlarmCard[] = [];
  const usedCardIds = new Set<number>();
  const usedTimeIds = new Set<number>();
  const nextCardId = { value: 1 };
  const nextTimeId = { value: 1 };

  for (const value of parsed) {
    const record = asRecord(value);
    if (!record) continue;

    const cardId = allocateId(record.id, usedCardIds, nextCardId);
    const legacyTitle = textValue(record.title, MAX_GROUP_TITLE_LENGTH);
    const groupTitle = legacyTitle || "Alarm grubu";
    const groupNote = textValue(record.note, MAX_NOTE_LENGTH);
    const groupImage = mediaUri(record.imageUri);
    const rawTimes = Array.isArray(record.times) ? record.times : [];
    const times: AlarmTime[] = [];

    for (const rawTime of rawTimes) {
      const timeId = allocateId(asRecord(rawTime)?.id, usedTimeIds, nextTimeId);
      const time = mode === "legacy"
        ? normalizeLegacyTime(rawTime, cardId, groupTitle, groupNote, groupImage, timeId, now)
        : normalizeModernTime(rawTime, cardId, timeId);
      if (time) times.push(time);
    }

    cards.push({ id: cardId, title: groupTitle, times });
  }

  return cards;
}
