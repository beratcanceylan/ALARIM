import type { AlarmTime, IsoWeekday } from "@/types/alarm";

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatRepeatDays(days: IsoWeekday[]): string {
  const sortedDays = [...new Set(days)].sort((a, b) => a - b);
  if (sortedDays.length === 0) return "Bir kez";
  if (sortedDays.length === 7) return "Her gün";

  const labels: Record<IsoWeekday, string> = {
    1: "Pzt",
    2: "Sal",
    3: "Çar",
    4: "Per",
    5: "Cum",
    6: "Cmt",
    7: "Paz",
  };
  return sortedDays.map((day) => labels[day]).join(", ");
}

/** Matches the original Android calculator: the next occurrence strictly after now. */
export function getNextTriggerDate(
  hour: number,
  minute: number,
  now = new Date(),
): Date {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

export function isoToExpoWeekday(day: IsoWeekday): number {
  // Expo/Android uses Sunday = 1, while the domain model uses ISO Monday = 1.
  return day === 7 ? 1 : day + 1;
}

export function getTimeLabel(time: AlarmTime): string {
  return `${formatTime(time.hour, time.minute)} · ${formatRepeatDays(time.repeatDays)}`;
}

export function getSoundLabel(time: Pick<AlarmTime, "soundName" | "soundUri">): string {
  if (time.soundName) return time.soundName;
  if (time.soundUri) return "Özel ses";
  return "Varsayılan ses";
}
