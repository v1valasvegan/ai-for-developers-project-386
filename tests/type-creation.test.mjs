import { expect, test } from "vitest";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { startBackend, temporaryDatabase } from "./support/servers.mjs";

const validType = {
  id: "  --Intro------30--  ",
  title: "  Знакомство  ",
  description: "  Обсудим ваш вопрос  ",
  durationMinutes: 30,
};

async function createType(backend, body) {
  return fetch(`${backend.url}/api/meeting-types`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function withBackend(run) {
  const database = await temporaryDatabase();
  let backend;
  try {
    backend = await startBackend(database.path);
    await run(backend);
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
}

test.each([
  "ab",
  "a".repeat(21),
  "---",
  "intro 30",
  "встреча",
  "intro_30",
  "intro/30",
  "intro.30",
  "Kelvin",
  "<b>intro</b>",
])("invalid code %s is rejected without adding a type", async (id) =>
  withBackend(async (backend) => {
    const response = await createType(backend, { ...validType, id });
    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.code).toBe("validation_error");
    expect(error.message).toEqual(expect.any(String));
    expect(error.fieldErrors).toEqual({ id: expect.any(String) });
    expect(await (await fetch(`${backend.url}/api/meeting-types`)).json()).toEqual({ items: [] });
  }),
);

test.each([
  ["title", "   "],
  ["title", "я".repeat(121)],
  ["description", "\t\n"],
  ["description", "я".repeat(2001)],
  ["durationMinutes", -15],
  ["durationMinutes", 0],
  ["durationMinutes", 14],
  ["durationMinutes", 16],
  ["durationMinutes", 481],
])("invalid %s is rejected with only its field error", async (field, value) =>
  withBackend(async (backend) => {
    const response = await createType(backend, { ...validType, [field]: value });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "validation_error",
      message: expect.any(String),
      fieldErrors: { [field]: expect.any(String) },
    });
  }),
);

test.each(["id", "title", "description", "durationMinutes"])(
  "missing %s is a structured validation error",
  async (field) =>
    withBackend(async (backend) => {
      const body = { ...validType };
      delete body[field];
      const response = await createType(backend, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "validation_error",
        message: expect.any(String),
        fieldErrors: { [field]: expect.any(String) },
      });
    }),
);

test.each([
  ["id", null],
  ["title", 42],
  ["description", { text: "Описание" }],
])("mistyped %s returns only its structured field error", async (field, value) =>
  withBackend(async (backend) => {
    const response = await createType(backend, { ...validType, [field]: value });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "validation_error",
      message: expect.any(String),
      fieldErrors: { [field]: expect.any(String) },
    });
  }),
);

test.each([null, [], "not an object"])(
  "non-object JSON %s gets a safe validation envelope",
  async (body) =>
    withBackend(async (backend) => {
      const response = await createType(backend, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "validation_error",
        message: "Проверьте поля запроса",
      });
    }),
);

test.each([15.5, "30", null, 2147483648])(
  "non-integer duration %s gets a field validation error",
  async (durationMinutes) =>
    withBackend(async (backend) => {
      const response = await createType(backend, { ...validType, durationMinutes });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "validation_error",
        message: expect.any(String),
        fieldErrors: { durationMinutes: expect.any(String) },
      });
    }),
);

test("malformed JSON returns the safe validation envelope, not extractor details", async () =>
  withBackend(async (backend) => {
    const response = await fetch(`${backend.url}/api/meeting-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{private invalid JSON",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "validation_error",
      message: "Проверьте поля запроса",
    });
  }));

test("unavailable storage rejects creation with a safe retryable error", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    backend = await startBackend(join(database.path, "missing", "private.sqlite3"));
    const response = await createType(backend, validType);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "storage_unavailable",
      message: "Хранилище временно недоступно. Повторите попытку",
    });
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("unexpected creation failure reveals no internal storage details", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await writeFile(database.path, "not SQLite: private fixture");
    backend = await startBackend(database.path);
    const response = await createType(backend, validType);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "internal_error",
      message: "Не удалось создать тип встречи",
    });
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("accepted field boundaries preserve plain text and equal titles, sorted by sole code", async () =>
  withBackend(async (backend) => {
    const upper = {
      id: "z".repeat(20),
      title: "Я".repeat(120),
      description: "я".repeat(2000),
      durationMinutes: 480,
    };
    const lower = {
      id: "aaa",
      title: "Я",
      description: "я",
      durationMinutes: 15,
    };
    const sameTitle = { ...lower, id: "bbb", durationMinutes: 30 };
    for (const item of [upper, lower, sameTitle]) {
      const response = await createType(backend, item);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(item);
    }
    expect(await (await fetch(`${backend.url}/api/meeting-types`)).json()).toEqual({
      items: [lower, sameTitle, upper],
    });
  }));

test("HTML-looking input remains literal plain text in the created resource", async () =>
  withBackend(async (backend) => {
    const literal = {
      ...validType,
      title: "<b>Название</b>",
      description: "<script>alert('not HTML')</script>",
    };
    const response = await createType(backend, literal);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "intro-30",
      title: "<b>Название</b>",
      description: "<script>alert('not HTML')</script>",
      durationMinutes: 30,
    });
  }));

test("concurrent normalized codes create exactly one type without overwriting it", async () =>
  withBackend(async (backend) => {
    const responses = await Promise.all([
      createType(backend, { ...validType, title: "Первый" }),
      createType(backend, { ...validType, id: "intro-30", title: "Второй" }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const winner = await responses.find((response) => response.status === 201).json();
    expect(await responses.find((response) => response.status === 409).json()).toEqual({
      code: "meeting_type_exists",
      message: "Этот код уже используется. Выберите другой",
      fieldErrors: { id: "Этот код уже используется. Выберите другой" },
    });
    expect(await (await fetch(`${backend.url}/api/meeting-types`)).json()).toEqual({
      items: [winner],
    });
  }));

test("an owner creates a normalized type that remains in the catalogue after restart", async () => {
  const database = await temporaryDatabase();
  let backend;
  const expected = {
    id: "intro-30",
    title: "Знакомство",
    description: "Обсудим ваш вопрос",
    durationMinutes: 30,
  };
  try {
    backend = await startBackend(database.path);
    const created = await createType(backend, validType);
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual(expected);
    expect(await (await fetch(`${backend.url}/api/meeting-types`)).json()).toEqual({
      items: [expected],
    });
    await backend.stop();
    backend = await startBackend(database.path);
    expect(await (await fetch(`${backend.url}/api/meeting-types`)).json()).toEqual({
      items: [expected],
    });
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});
