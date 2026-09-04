import { describe, expect, test } from "bun:test";

import {
  formatNextOccurrence,
  getNextOccurrenceDate,
  isWithinFiveMinutes,
} from "@/lib/alarm-utils";
import type { AlarmSchedule, AlarmTime } from "@/types/alarm";

function time(overrides: Partial<AlarmTime> = {}): AlarmTime {
  return {
    id: 1,
    cardId: 1,
    title: "Test alarmı",
    note: "",
    imageUri: null,
    hour: 8,
    minute: 0,
    schedule: { type: "once", date: "2026-09-07" },
    soundUri: null,
    soundName: null,
    snoozeMinutes: 10,
    enabled: true,
    ...overrides,
  };
}

describe("alarm occurrence helpers", () => {
  test("does not move an expired dated alarm to tomorrow", () => {
    const schedule = { type: "once" as const, date: "2026-09-07" };
    const now = new Date(2026, 8, 7, 9, 0);

    expect(getNextOccurrenceDate(schedule, 8, 0, now)).toBeNull();
  });

  test("finds the next selected weekly day", () => {
    const schedule: AlarmSchedule = { type: "weekly", repeatDays: [1] };
    const now = new Date(2026, 8, 6, 9, 0);
    const next = getNextOccurrenceDate(schedule, 8, 0, now);

    expect(next?.getFullYear()).toBe(2026);
    expect(next?.getMonth()).toBe(8);
    expect(next?.getDate()).toBe(7);
    expect(next?.getHours()).toBe(8);
  });

  test("formats the next alarm with a relative Turkish day label", () => {
    const alarm = time({ schedule: { type: "once", date: "2026-09-07" } });
    expect(formatNextOccurrence(alarm, new Date(2026, 8, 6, 9, 0))).toContain("Yarın");
  });

  test("detects alarms less than five minutes apart on the same schedule", () => {
    const left = time({ minute: 0 });
    const right = time({ id: 2, minute: 4 });
    expect(isWithinFiveMinutes(left, right)).toBe(true);
    expect(isWithinFiveMinutes(left, time({ id: 3, minute: 5 }))).toBe(false);
  });
});
