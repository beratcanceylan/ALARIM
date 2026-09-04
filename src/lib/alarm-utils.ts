import {
  formatLocalDateKey,
  type AlarmSchedule,
  type AlarmTime,
  type IsoWeekday,
  WEEKDAYS,
} from "@/types/alarm";

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatRepeatDays(days: IsoWeekday[]): string {
  const sortedDays = [...new Set(days)].sort((left, right) => left - right);
  if (sortedDays.length === 0) return "Gün seçilmedi";
  if (sortedDays.length === 7) return "Her gün";

  return sortedDays
    .map((day) => WEEKDAYS.find((weekday) => weekday.value === day)?.label ?? "")
    .filter(Boolean)
    .join(", ");
}

function parseLocalDateKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function withTime(date: Date, hour: number, minute: number): Date {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function isoWeekday(date: Date): IsoWeekday {
  return date.getDay() === 0 ? 7 : (date.getDay() as IsoWeekday);
}

export function getDateAtTime(dateKey: string, hour: number, minute: number): Date | null {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }
  const date = parseLocalDateKey(dateKey);
  return date ? withTime(date, hour, minute) : null;
}

/** Returns the next occurrence without ever moving a dated one-time alarm forward. */
export function getNextOccurrenceDate(
  schedule: AlarmSchedule,
  hour: number,
  minute: number,
  now = new Date(),
): Date | null {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (schedule.type === "once") {
    const date = getDateAtTime(schedule.date, hour, minute);
    return date && date.getTime() > now.getTime() ? date : null;
  }

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    if (schedule.repeatDays.includes(isoWeekday(candidate)) && candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }

  return null;
}

/** Matches the legacy one-time alarm behavior: the next occurrence strictly after now. */
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

export function formatSchedule(schedule: AlarmSchedule): string {
  if (schedule.type === "weekly") return `Her hafta · ${formatRepeatDays(schedule.repeatDays)}`;

  const date = parseLocalDateKey(schedule.date);
  if (!date) return "Tarih seçilmedi";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatScheduleShort(schedule: AlarmSchedule): string {
  if (schedule.type === "weekly") return formatRepeatDays(schedule.repeatDays);

  const date = parseLocalDateKey(schedule.date);
  if (!date) return "Tarih seçilmedi";
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(date);
}

export function formatNextOccurrence(
  time: Pick<AlarmTime, "hour" | "minute" | "schedule" | "enabled">,
  now = new Date(),
): string {
  if (!time.enabled) return "Kapalı";
  const occurrence = getNextOccurrenceDate(time.schedule, time.hour, time.minute, now);
  if (!occurrence) return "Süresi geçti";

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const occurrenceDay = new Date(occurrence);
  occurrenceDay.setHours(0, 0, 0, 0);
  const difference = Math.round((occurrenceDay.getTime() - today.getTime()) / 86_400_000);
  const dayLabel = difference === 0
    ? "Bugün"
    : difference === 1
      ? "Yarın"
      : new Intl.DateTimeFormat("tr-TR", { weekday: "short", day: "numeric", month: "short" }).format(occurrence);

  return `${dayLabel} · ${formatTime(occurrence.getHours(), occurrence.getMinutes())}`;
}

export function getTimeLabel(time: AlarmTime): string {
  return `${formatTime(time.hour, time.minute)} · ${formatScheduleShort(time.schedule)}`;
}

export function getSoundLabel(time: Pick<AlarmTime, "soundName" | "soundUri">): string {
  if (time.soundName) return time.soundName;
  if (time.soundUri) return "Özel ses";
  return "Varsayılan ses";
}

export function isWithinFiveMinutes(left: AlarmTime, right: AlarmTime): boolean {
  const leftSchedule = left.schedule;
  const rightSchedule = right.schedule;
  if (leftSchedule.type !== rightSchedule.type) return false;

  if (leftSchedule.type === "weekly" && rightSchedule.type === "weekly") {
    if (!leftSchedule.repeatDays.some((day) => rightSchedule.repeatDays.includes(day))) return false;
  }

  if (leftSchedule.type === "once" && rightSchedule.type === "once" && leftSchedule.date !== rightSchedule.date) {
    return false;
  }

  return Math.abs((left.hour * 60 + left.minute) - (right.hour * 60 + right.minute)) < 5;
}

export function formatDateKeyForInput(date: Date): string {
  return formatLocalDateKey(date);
}
