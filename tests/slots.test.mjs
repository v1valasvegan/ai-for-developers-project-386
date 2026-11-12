import { expect, test } from "vitest";
import { startBackend, temporaryDatabase } from "./support/servers.mjs";
import { prepareCatalogue } from "./support/catalogue-fixture.mjs";
import { prepareSlots } from "./support/slots-fixture.mjs";
import { createClient } from "../frontend/src/api/generated/client/index";
import { listMeetingTypeSlots } from "../frontend/src/api/generated/sdk.gen";

test.each([
  [
    "nested and partial",
    "2026-11-11T07:00:00Z",
    "2026-11-11T08:00:00Z",
    "2026-11-11T08:00:00Z",
    "2026-11-11T08:30:00Z",
  ],
  [
    "encompassing",
    "2026-11-11T07:15:00Z",
    "2026-11-11T07:30:00Z",
    "2026-11-11T07:30:00Z",
    "2026-11-11T08:00:00Z",
  ],
  [
    "partial at both ends",
    "2026-11-11T07:15:00Z",
    "2026-11-11T08:15:00Z",
    "2026-11-11T08:15:00Z",
    "2026-11-11T08:45:00Z",
  ],
])(
  "all-type %s overlaps disappear but adjacent slots stay free",
  async (_case, occupiedStart, occupiedEnd, firstStart, firstEnd) => {
    const database = await temporaryDatabase();
    let backend;
    try {
      await prepareSlots(database.path, { occupied: [[occupiedStart, occupiedEnd]] });
      backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
      const response = await fetch(`${backend.url}/api/meeting-types/intro-30/slots`);
      const result = await response.json();
      expect(result.items[0]).toEqual({ startsAt: firstStart, endsAt: firstEnd });
      expect(result.items).not.toContainEqual({
        startsAt: "2026-11-11T07:00:00Z",
        endsAt: "2026-11-11T07:30:00Z",
      });
      const again = await fetch(`${backend.url}/api/meeting-types/intro-30/slots`);
      expect(await again.json()).toEqual(result);
    } finally {
      await backend?.stop();
      await database.cleanup();
    }
  },
);

test.each([
  ["intro-30", "2026-11-11T14:30:00Z", 31],
  ["review-60", "2026-11-11T14:00:00Z", 29],
  ["all-day", "2026-11-11T07:00:00Z", 1],
])(
  "%s fits the whole duration before 18:00, never starts at 18:00",
  async (id, lastStart, dailyCount) => {
    const database = await temporaryDatabase();
    let backend;
    try {
      await prepareSlots(database.path, { fullDay: true });
      backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
      const { data } = await listMeetingTypeSlots({
        client: createClient({ baseUrl: backend.url }),
        path: { id },
        throwOnError: true,
      });
      const firstDay = data.items.filter(({ startsAt }) => startsAt.startsWith("2026-11-11"));
      expect(firstDay).toHaveLength(dailyCount);
      expect(firstDay.at(-1)).toEqual({ startsAt: lastStart, endsAt: "2026-11-11T15:00:00Z" });
    } finally {
      await backend?.stop();
      await database.cleanup();
    }
  },
);

test("a known fully occupied type returns metadata and empty items; an unknown type returns a coded 404", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await prepareSlots(database.path, {
      occupied: [["2026-11-10T21:00:00Z", "2026-11-24T21:00:00Z"]],
    });
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    const response = await fetch(`${backend.url}/api/meeting-types/intro-30/slots`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      serverTime: "2026-11-10T12:00:00Z",
      windowStart: "2026-11-10T21:00:00Z",
      windowEnd: "2026-11-24T21:00:00Z",
      timeZone: "Europe/Moscow",
      items: [],
      occupied: [{ startsAt: "2026-11-10T21:00:00Z", endsAt: "2026-11-24T21:00:00Z" }],
    });
    const missing = await fetch(`${backend.url}/api/meeting-types/missing/slots`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      code: "meeting_type_not_found",
      message: "Тип встречи не найден",
    });
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("server Moscow midnight moves the window immediately, regardless of written offset", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path, { time: "2026-11-10T23:59:59+03:00" });
    const before = await (await fetch(`${backend.url}/api/meeting-types/intro-30/slots`)).json();
    expect(before.windowStart).toBe("2026-11-10T21:00:00Z");
    expect(before.items[0].startsAt).toBe("2026-11-11T07:00:00Z");
    await backend.setTime("2026-11-10T21:00:00Z");
    const after = await (await fetch(`${backend.url}/api/meeting-types/intro-30/slots`)).json();
    expect(after.serverTime).toBe("2026-11-10T21:00:00Z");
    expect(after.windowStart).toBe("2026-11-11T21:00:00Z");
    expect(after.windowEnd).toBe("2026-11-25T21:00:00Z");
    expect(after.items[0].startsAt).toBe("2026-11-12T07:00:00Z");
    expect(after.items.at(-1).endsAt).toBe("2026-11-25T15:00:00Z");
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("availability returns the whole Moscow window with independent quarter-hour starts", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    const response = await fetch(`${backend.url}/api/meeting-types/intro-30/slots`);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({
      serverTime: "2026-11-10T12:00:00Z",
      windowStart: "2026-11-10T21:00:00Z",
      windowEnd: "2026-11-24T21:00:00Z",
      timeZone: "Europe/Moscow",
    });
    expect(result.items).toHaveLength(310);
    const starts = result.items.map(({ startsAt }) => startsAt);
    expect(starts).toEqual([...starts].sort());
    for (const slot of result.items) {
      expect(slot.startsAt).toMatch(/T\d{2}:(00|15|30|45):00Z$/);
      expect(slot.endsAt).toMatch(/T\d{2}:(00|15|30|45):00Z$/);
    }
    expect(result.items.slice(0, 2)).toEqual([
      { startsAt: "2026-11-11T07:00:00Z", endsAt: "2026-11-11T07:30:00Z" },
      { startsAt: "2026-11-11T07:15:00Z", endsAt: "2026-11-11T07:45:00Z" },
    ]);
    expect(result.items.at(-1)).toEqual({
      startsAt: "2026-11-24T14:30:00Z",
      endsAt: "2026-11-24T15:00:00Z",
    });
    expect(
      result.items.some(
        ({ startsAt }) => startsAt.startsWith("2026-11-14") || startsAt.startsWith("2026-11-15"),
      ),
    ).toBe(false);
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});
