export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type AlarmTime = {
  id: number;
  cardId: number;
  hour: number;
  minute: number;
  /** ISO-8601 values: Monday = 1 ... Sunday = 7. Empty means one-time. */
  repeatDays: IsoWeekday[];
  soundUri: string | null;
  soundName: string | null;
  snoozeMinutes: number;
  enabled: boolean;
};

export type AlarmCard = {
  id: number;
  title: string;
  imageUri: string | null;
  note: string;
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

export function createEmptyTime(cardId = 0): AlarmTime {
  return {
    id: nextDraftTimeId--,
    cardId,
    hour: 8,
    minute: 0,
    repeatDays: [],
    soundUri: null,
    soundName: null,
    snoozeMinutes: 10,
    enabled: true,
  };
}
