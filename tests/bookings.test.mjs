import { expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { startBackend, temporaryDatabase } from "./support/servers.mjs";
import { createClient } from "../frontend/src/api/generated/client/index";
import { createBooking, listBookings } from "../frontend/src/api/generated/sdk.gen";

const time = "2026-11-10T12:00:00Z";
const payload = {
  meetingTypeId: "intro-30",
  startsAt: "2026-11-11T10:00:00+03:00",
  name: "  Анна <b>  ",
  email: " Anna@Example.com ",
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
};
async function post(backend, path, body) {
  return fetch(`${backend.url}/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function setup(run) {
  const database = await temporaryDatabase();
  let backend;
  try {
    backend = await startBackend(database.path, { time });
    await post(backend, "meeting-types", {
      id: "intro-30",
      title: "Знакомство",
      description: "Вопросы",
      durationMinutes: 30,
    });
    await run(backend, database);
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
}

test("guest creates a normalized booking and owner sees the server-calculated interval", async () => {
  await setup(async (backend) => {
    const client = createClient({ baseUrl: backend.url });
    const { response, data: booking } = await createBooking({
      client,
      body: payload,
      throwOnError: true,
    });
    expect(response.status).toBe(201);
    expect(booking).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      meetingTypeId: "intro-30",
      meetingTypeTitle: "Знакомство",
      startsAt: "2026-11-11T07:00:00Z",
      endsAt: "2026-11-11T07:30:00Z",
      name: "Анна <b>",
      email: "Anna@Example.com",
    });
    const { data: list } = await listBookings({ client, throwOnError: true });
    expect(list).toEqual({ serverTime: time, items: [{ ...booking, status: "upcoming" }] });
  });
});

test("guest availability exposes sorted occupied intervals across types without identity or guest data, only within the window", async () => {
  await setup(async (backend) => {
    await post(backend, "meeting-types", {
      id: "other-60",
      title: "Другой тип",
      description: "Другой вопрос",
      durationMinutes: 60,
    });
    for (const [meetingTypeId, startsAt, idempotencyKey] of [
      ["other-60", "2026-11-24T11:00:00Z", "00000000-0000-4000-8000-000000000011"],
      ["intro-30", "2026-11-11T11:00:00Z", "00000000-0000-4000-8000-000000000012"],
    ]) {
      expect(
        (await post(backend, "bookings", { ...payload, meetingTypeId, startsAt, idempotencyKey }))
          .status,
      ).toBe(201);
    }
    const availability = await (
      await fetch(`${backend.url}/api/meeting-types/intro-30/slots`)
    ).json();
    expect(availability.occupied).toEqual([
      { startsAt: "2026-11-11T11:00:00Z", endsAt: "2026-11-11T11:30:00Z" },
      { startsAt: "2026-11-24T11:00:00Z", endsAt: "2026-11-24T12:00:00Z" },
    ]);
    expect(availability.items.some((slot) => slot.startsAt === "2026-11-11T11:00:00Z")).toBe(false);
    await backend.setTime("2026-11-23T12:00:00Z");
    const shifted = await (await fetch(`${backend.url}/api/meeting-types/intro-30/slots`)).json();
    expect(shifted.occupied).toEqual([
      { startsAt: "2026-11-24T11:00:00Z", endsAt: "2026-11-24T12:00:00Z" },
    ]);
  });
});

test("invalid guest fields are inline, while other values remain valid", async () => {
  await setup(async (backend) => {
    for (const [field, value] of [
      ["name", "  "],
      ["name", "я".repeat(121)],
      ["email", "bad"],
      ["email", "a".repeat(243) + "@example.com"],
      ["idempotencyKey", "not-a-uuid"],
      ["startsAt", "2026-11-11T07:00:00"],
      ["startsAt", "2026-11-31T07:00:00Z"],
      ["startsAt", "2026-11-11T24:00:00Z"],
      ["startsAt", "2026-11-11T07:00:00+24:00"],
    ]) {
      const response = await post(backend, "bookings", { ...payload, [field]: value });
      expect(response.status, field).toBe(400);
      expect(await response.json()).toEqual({
        code: "validation_error",
        message: expect.any(String),
        fieldErrors: { [field]: expect.any(String) },
      });
    }
    const missing = await post(backend, "bookings", {});
    expect(missing.status).toBe(400);
    expect((await missing.json()).fieldErrors).toEqual(
      Object.fromEntries(Object.keys(payload).map((key) => [key, expect.any(String)])),
    );
    const extra = await post(backend, "bookings", { ...payload, endsAt: "2026-11-11T08:00:00Z" });
    expect(extra.status).toBe(400);
    expect((await extra.json()).code).toBe("validation_error");
  });
});

test.each([
  ["coincident", "2026-11-11T07:00:00Z", 60, 409],
  ["partial overlap", "2026-11-11T07:30:00Z", 30, 409],
  ["true partial overlap", "2026-11-11T07:30:00Z", 60, 409],
  ["overlaps left edge", "2026-11-11T06:45:00Z", 30, 400],
  ["nested", "2026-11-11T07:15:00Z", 30, 409],
  ["encompassing", "2026-11-11T07:00:00Z", 90, 409],
  ["adjacent", "2026-11-11T08:00:00Z", 30, 201],
])("all types share occupancy: %s", async (_case, startsAt, durationMinutes, status) => {
  await setup(async (backend) => {
    await post(backend, "meeting-types", {
      id: "long-60",
      title: "Час",
      description: "Общий календарь",
      durationMinutes: 60,
    });
    const first = await post(backend, "bookings", { ...payload, meetingTypeId: "long-60" });
    expect(first.status).toBe(201);
    await post(backend, "meeting-types", {
      id: "other-type",
      title: "Иной тип",
      description: "Общий календарь",
      durationMinutes,
    });
    const second = await post(backend, "bookings", {
      ...payload,
      meetingTypeId: "other-type",
      startsAt,
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    });
    expect(second.status).toBe(status);
    if (status === 409) expect((await second.json()).code).toBe("slot_conflict");
    const list = await fetch(`${backend.url}/api/bookings`).then((r) => r.json());
    expect(list.items).toHaveLength(status === 201 ? 2 : 1);
  });
});

test("new bookings accept quarter-hour starts and the last full interval in explicit offsets", async () => {
  await setup(async (backend) => {
    const quarter = await post(backend, "bookings", {
      ...payload,
      startsAt: "2026-11-11T10:15:00+03:00",
    });
    expect(quarter.status).toBe(201);
    const first = await quarter.json();
    expect(first).toMatchObject({
      startsAt: "2026-11-11T07:15:00Z",
      endsAt: "2026-11-11T07:45:00Z",
    });
    const last = await post(backend, "bookings", {
      ...payload,
      startsAt: "2026-11-11T06:30:00-08:00",
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    });
    expect(last.status).toBe(201);
    const second = await last.json();
    expect(second).toMatchObject({
      startsAt: "2026-11-11T14:30:00Z",
      endsAt: "2026-11-11T15:00:00Z",
    });
    expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toEqual([
      { ...first, status: "upcoming" },
      { ...second, status: "upcoming" },
    ]);
  });
});

test("successful key replays normalized moments and rejects changed data", async () => {
  await setup(async (backend) => {
    const first = await post(backend, "bookings", payload);
    const booking = await first.json();
    const repeat = await post(backend, "bookings", {
      ...payload,
      name: "Анна <b>",
      email: "Anna@Example.com",
      startsAt: "2026-11-11T07:00:00Z",
    });
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toEqual(booking);
    for (const change of [
      { name: "Другое имя" },
      { email: "other@example.com" },
      { startsAt: "2026-11-11T08:00:00Z" },
      { meetingTypeId: "unknown" },
    ]) {
      const changed = await post(backend, "bookings", { ...payload, ...change });
      expect(changed.status).toBe(409);
      expect((await changed.json()).code).toBe("idempotency_key_reused");
    }
    expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toHaveLength(
      1,
    );
  });
});

test.each([false, true])(
  "real simultaneous requests with identical keys=%s create exactly one booking",
  async (identical) => {
    await setup(async (backend) => {
      const responses = await Promise.all([
        post(backend, "bookings", payload),
        post(backend, "bookings", {
          ...payload,
          idempotencyKey: identical
            ? payload.idempotencyKey
            : "00000000-0000-4000-8000-000000000002",
        }),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual(identical ? [200, 201] : [201, 409]);
      const bodies = await Promise.all(responses.map((r) => r.json()));
      if (identical) expect(bodies[0]).toEqual(bodies[1]);
      else expect(bodies.find((body) => body.code)?.code).toBe("slot_conflict");
      const list = await fetch(`${backend.url}/api/bookings`).then((r) => r.json());
      expect(list.items).toHaveLength(1);
    });
  },
);

test("owner status changes at exact boundaries and successful replay survives midnight and restart", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    backend = await startBackend(database.path, { time });
    await post(backend, "meeting-types", {
      id: "intro-30",
      title: "Знакомство",
      description: "Вопросы",
      durationMinutes: 30,
    });
    const created = await post(backend, "bookings", payload).then((r) => r.json());
    const later = await post(backend, "bookings", {
      ...payload,
      startsAt: "2026-11-11T08:00:00Z",
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    }).then((r) => r.json());
    await backend.stop();
    backend = await startBackend(database.path, { time });
    expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toEqual([
      { ...created, status: "upcoming" },
      { ...later, status: "upcoming" },
    ]);
    for (const [now, statuses] of [
      ["2026-11-11T06:59:59.999Z", ["upcoming", "upcoming"]],
      ["2026-11-11T07:00:00Z", ["ongoing", "upcoming"]],
      ["2026-11-11T07:29:59.999Z", ["ongoing", "upcoming"]],
      ["2026-11-11T07:30:00Z", ["upcoming"]],
    ]) {
      await backend.setTime(now);
      const list = await fetch(`${backend.url}/api/bookings`).then((r) => r.json());
      expect(list.serverTime).toBe(now);
      expect(list.items.map((item) => item.status)).toEqual(statuses);
      expect(list.items.map((item) => item.id)).toEqual(
        statuses.length === 2 ? [created.id, later.id] : [later.id],
      );
      const replay = await post(backend, "bookings", payload);
      expect(replay.status).toBe(200);
      expect(await replay.json()).toEqual(created);
    }
    await backend.stop();
    backend = await startBackend(database.path, { time: "2026-11-26T12:00:00Z" });
    expect(
      (await fetch(`${backend.url}/api/meeting-types`).then((r) => r.json())).items,
    ).toHaveLength(1);
    const replay = await post(backend, "bookings", payload);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(created);
    expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toEqual([]);
    const fresh = await post(backend, "bookings", {
      ...payload,
      idempotencyKey: "00000000-0000-4000-8000-000000000003",
    });
    expect(fresh.status).toBe(400);
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("new requests revalidate the whole grid, workday and current Moscow window", async () => {
  await setup(async (backend) => {
    for (const startsAt of [
      "2026-11-10T07:00:00Z",
      "2026-11-25T07:00:00Z",
      "2026-11-14T07:00:00Z",
      "2026-11-11T06:45:00Z",
      "2026-11-11T14:45:00Z",
      "2026-11-11T15:00:00Z",
      "2026-11-11T07:07:00Z",
      "2026-11-11T07:15:01Z",
      "2026-11-11T07:15:00.001Z",
    ]) {
      const invalid = await post(backend, "bookings", { ...payload, startsAt });
      expect(invalid.status, startsAt).toBe(400);
      expect((await invalid.json()).code).toBe("validation_error");
    }
    const unknown = await post(backend, "bookings", { ...payload, meetingTypeId: "unknown" });
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).code).toBe("meeting_type_not_found");
    await backend.setTime("2026-11-10T21:00:00Z");
    const stale = await post(backend, "bookings", payload);
    expect(stale.status).toBe(400);
    expect((await stale.json()).fieldErrors.startsAt).toEqual(expect.any(String));
  });
});

test("an unreadable server time fails safely without creating a booking or exposing clock details", async () => {
  await setup(async (backend) => {
    await backend.setTime("private-invalid-clock-input");
    for (const response of [
      await post(backend, "bookings", payload),
      await fetch(`${backend.url}/api/bookings`),
      await fetch(`${backend.url}/api/meeting-types/intro-30/slots`),
    ]) {
      expect(response.status).toBe(500);
      const error = await response.json();
      expect(error).toEqual({ code: "internal_error", message: expect.any(String) });
      expect(error.message).not.toMatch(/clock|private|parse|invalid/i);
    }
    expect((await fetch(`${backend.url}/api/health`)).status).toBe(200);
    await backend.setTime(time);
    expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toEqual([]);
    expect((await post(backend, "bookings", payload)).status).toBe(201);
  });
});

test("SQLite failure is unavailable, not an occupancy conflict, and internal details stay private", async () => {
  await setup(async (backend, database) => {
    const { rm, writeFile } = await import("node:fs/promises");
    await rm(database.path);
    for (const response of [
      await post(backend, "bookings", payload),
      await fetch(`${backend.url}/api/bookings`),
    ]) {
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        code: "storage_unavailable",
        message: expect.any(String),
      });
    }
    await writeFile(database.path, "not a SQLite database");
    for (const response of [
      await post(backend, "bookings", payload),
      await fetch(`${backend.url}/api/bookings`),
    ]) {
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ code: "internal_error", message: expect.any(String) });
      expect(body.message).not.toMatch(/sqlite|database|SELECT/i);
    }
  });
});

test.each([
  ["partial left overlap", "2026-11-11T07:00:00Z", 60, 409],
  ["true partial left overlap", "2026-11-11T07:00:00Z", 45, 409],
  ["strict encompassing", "2026-11-11T07:00:00Z", 120, 409],
  ["adjacent before", "2026-11-11T07:00:00Z", 30, 201],
])(
  "later existing intervals reject %s without rejecting adjacency",
  async (_case, startsAt, durationMinutes, status) => {
    await setup(async (backend) => {
      expect(
        (await post(backend, "bookings", { ...payload, startsAt: "2026-11-11T07:30:00Z" })).status,
      ).toBe(201);
      await post(backend, "meeting-types", {
        id: "other-type",
        title: "Иной тип",
        description: "Общий календарь",
        durationMinutes,
      });
      const response = await post(backend, "bookings", {
        ...payload,
        meetingTypeId: "other-type",
        startsAt,
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
      });
      expect(response.status).toBe(status);
      if (status === 409) expect((await response.json()).code).toBe("slot_conflict");
      expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toHaveLength(
        status === 409 ? 1 : 2,
      );
    });
  },
);

test("a held SQLite writer yields storage_unavailable with no partially saved booking or key", async () => {
  await setup(async (backend, database) => {
    const writer = new DatabaseSync(database.path);
    try {
      writer.exec("BEGIN IMMEDIATE");
      const response = await post(backend, "bookings", payload);
      expect(response.status).toBe(503);
      expect((await response.json()).code).toBe("storage_unavailable");
      writer.exec("ROLLBACK");
      expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toEqual([]);
      const retry = await post(backend, "bookings", payload);
      expect(retry.status).toBe(201);
      expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toHaveLength(
        1,
      );
    } finally {
      writer.close();
    }
  });
}, 15000);

test("malformed request fields use the agreed error envelope, never generated plaintext", async () => {
  await setup(async (backend) => {
    for (const change of [
      { meetingTypeId: "<b>unknown</b>" },
      { meetingTypeId: 42 },
      { idempotencyKey: null },
      { startsAt: "<script>" },
    ]) {
      const response = await post(backend, "bookings", { ...payload, ...change });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("validation_error");
      expect(body.fieldErrors[Object.keys(change)[0]]).toEqual(expect.any(String));
    }
    const invalidJson = await fetch(`${backend.url}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.json()).toEqual({
      code: "validation_error",
      message: expect.any(String),
    });
  });
});

test("maximum normalized guest lengths and repeated guest contacts are accepted for separate intentions", async () => {
  await setup(async (backend) => {
    const name = "Я".repeat(120);
    const email =
      "A".repeat(64) + "@" + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(61);
    const first = await post(backend, "bookings", {
      ...payload,
      name: ` ${name} `,
      email: ` ${email} `,
    });
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ name, email });
    const second = await post(backend, "bookings", {
      ...payload,
      name,
      email,
      startsAt: "2026-11-11T07:30:00Z",
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    });
    expect(second.status).toBe(201);
    expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toHaveLength(
      2,
    );
  });
});

test("two simultaneous retries of a previously successful attempt return the same one record", async () => {
  await setup(async (backend) => {
    const created = await post(backend, "bookings", payload).then((r) => r.json());
    const retries = await Promise.all([
      post(backend, "bookings", payload),
      post(backend, "bookings", payload),
    ]);
    expect(retries.map((response) => response.status)).toEqual([200, 200]);
    expect(await Promise.all(retries.map((response) => response.json()))).toEqual([
      created,
      created,
    ]);
    expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toEqual([
      { ...created, status: "upcoming" },
    ]);
  });
});

test("owner list merges types in chronological order rather than insertion or type order", async () => {
  await setup(async (backend) => {
    await post(backend, "meeting-types", {
      id: "another-type",
      title: "Час",
      description: "Иной тип",
      durationMinutes: 60,
    });
    const later = await post(backend, "bookings", {
      ...payload,
      startsAt: "2026-11-11T09:00:00Z",
    }).then((r) => r.json());
    const earlier = await post(backend, "bookings", {
      ...payload,
      meetingTypeId: "another-type",
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    }).then((r) => r.json());
    const { data } = await listBookings({
      client: createClient({ baseUrl: backend.url }),
      throwOnError: true,
    });
    expect(data.items).toEqual([
      { ...earlier, status: "upcoming" },
      { ...later, status: "upcoming" },
    ]);
  });
});
