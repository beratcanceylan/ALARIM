export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type AlarmSchedule =
  | {
      type: "weekly";
      repeatDays: IsoWeekday[];
    }
  | {
      type: "once";
      /** A local calendar date in YYYY-MM-DD format. */
      date: string;
    };

export type AlarmTime = {
  id: number;
  cardId: number;
  title: string;
  note: string;
  imageUri: string | null;
  hour: number;
  minute: number;
  schedule: AlarmSchedule;
  soundUri: string | null;
  soundName: string | null;
  snoozeMinutes: number;
  enabled: boolean;
};

export type AlarmCard = {
  id: number;
  /** Required group name shown on the home screen. */
  title: string;
  times: AlarmTime[];
};

export type AlarmCardDraft = Omit<AlarmCard, "times"> & {
  times: AlarmTime[];
};

let nextDraftTimeId = -1;

export const SNOOZE_OPTIONS = [1, 5, 10, 15, 30] as const;

export const WEEKDAYS: readonly { value: IsoWeekday; label: string }[] = [
  { value: 1, label: "Pzt" },
  { value: 2, label: "Sal" },
  { value: 3, label: "Çar" },
  { value: 4, label: "Per" },
  { value: 5, label: "Cum" },
  { value: 6, label: "Cmt" },
  { value: 7, label: "Paz" },
];

export function formatLocalDateKey(date: Date): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value, index) => (index === 0 ? String(value) : String(value).padStart(2, "0")))
    .join("-");
}

export function getDefaultOnceDate(hour: number, minute: number, now: Date): string {
  const date = new Date(now);
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
  return formatLocalDateKey(date);
}

export function createEmptyTime(cardId = 0, now = new Date()): AlarmTime {
  const hour = 8;
  const minute = 0;

  return {
    id: nextDraftTimeId--,
    cardId,
    title: "",
    note: "",
    imageUri: null,
    hour,
    minute,
    schedule: { type: "once", date: getDefaultOnceDate(hour, minute, now) },
    soundUri: null,
    soundName: null,
    snoozeMinutes: 10,
    enabled: true,
  };
}
