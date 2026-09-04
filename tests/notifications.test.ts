import { expect, test } from "bun:test";

import { notificationIdentifiersFor } from "@/lib/notification-utils";

test("generates isolated identifiers for one-time, snooze, and weekly notifications", () => {
  const identifiers = notificationIdentifiersFor(42);

  expect(identifiers).toHaveLength(9);
  expect(new Set(identifiers).size).toBe(identifiers.length);
  expect(identifiers).toContain("alarm_42_once");
  expect(identifiers).toContain("alarm_42_snooze");
  expect(identifiers).toContain("alarm_42_day_7");
});
