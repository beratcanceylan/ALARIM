import { describe, expect, test } from "bun:test";

import { parseStoredCards } from "@/lib/storage-core";

describe("alarm storage migration", () => {
  test("moves v1 card metadata and image onto each alarm", () => {
    const legacy = JSON.stringify([
      {
        id: 4,
        title: "Sabah rutini",
        note: "Su iç",
        imageUri: "file:///data/images/morning.jpg",
        times: [
          { id: 7, hour: 7, minute: 30, repeatDays: [1, 3], enabled: true },
          { id: 8, hour: 20, minute: 0, repeatDays: [], enabled: false },
        ],
      },
    ]);

    const cards = parseStoredCards(legacy, "legacy", new Date(2026, 8, 6, 9, 0));
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe("Sabah rutini");
    expect(cards[0].times[0].title).toBe("Sabah rutini");
    expect(cards[0].times[0].note).toBe("Su iç");
    expect(cards[0].times[0].imageUri).toBe("file:///data/images/morning.jpg");
    expect(cards[0].times[0].schedule).toEqual({ type: "weekly", repeatDays: [1, 3] });
    expect(cards[0].times[1].schedule).toEqual({ type: "once", date: "2026-09-06" });
    expect(cards[0].times[1].enabled).toBe(false);
  });

  test("normalizes duplicate IDs and rejects unsupported media URIs", () => {
    const modern = JSON.stringify([
      {
        id: 1,
        title: "Grup",
        times: [
          { id: 2, title: "Bir", schedule: { type: "weekly", repeatDays: [1] }, imageUri: "javascript:bad" },
          { id: 2, title: "İki", schedule: { type: "once", date: "2026-12-01" }, imageUri: "file:///data/images/two.jpg" },
        ],
      },
    ]);

    const cards = parseStoredCards(modern, "modern");
    expect(cards[0].times[0].imageUri).toBeNull();
    expect(cards[0].times[1].id).not.toBe(cards[0].times[0].id);
  });

  test("drops invalid schedule combinations and normalizes time bounds", () => {
    const modern = JSON.stringify([
      {
        id: 10,
        title: "Geçerli grup",
        times: [
          { id: 11, hour: 99, minute: -3, schedule: { type: "weekly", repeatDays: [] } },
          { id: 12, schedule: { type: "once", date: "2026-02-30" } },
          { id: 13, hour: 25, minute: 61, schedule: { type: "once", date: "2026-12-01" } },
        ],
      },
    ]);

    const cards = parseStoredCards(modern, "modern");
    expect(cards[0].times).toHaveLength(1);
    expect(cards[0].times[0].hour).toBe(23);
    expect(cards[0].times[0].minute).toBe(59);
    expect(cards[0].times[0].schedule).toEqual({ type: "once", date: "2026-12-01" });
  });
});
