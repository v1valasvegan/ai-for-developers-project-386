import { expect, test } from "vitest";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { startBackend, temporaryDatabase } from "./support/servers.mjs";
import { prepareCatalogue } from "./support/catalogue-fixture.mjs";
import { createClient } from "../frontend/src/api/generated/client/index";
import { listMeetingTypes } from "../frontend/src/api/generated/sdk.gen";

test("a new SQLite catalogue is empty and health remains available", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    backend = await startBackend(database.path);
    const response = await fetch(`${backend.url}/api/meeting-types`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    const health = await fetch(`${backend.url}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("an unavailable database returns a safe retryable storage error", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    backend = await startBackend(join(database.path, "missing", "private.sqlite3"));
    const response = await fetch(`${backend.url}/api/meeting-types`);
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

test("an unexpected storage failure returns no implementation details", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await writeFile(database.path, "not a SQLite database: private fixture");
    backend = await startBackend(database.path);
    const response = await fetch(`${backend.url}/api/meeting-types`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "internal_error",
      message: "Не удалось загрузить типы встреч",
    });
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("the SDK reads types sorted by code, unchanged after a server restart", async () => {
  const database = await temporaryDatabase();
  let backend;
  const expected = {
    items: [
      {
        id: "intro-30",
        title: "Знакомство",
        description: "Обсудим ваш вопрос",
        durationMinutes: 30,
      },
      {
        id: "review-60",
        title: "Разбор проекта",
        description: "Подробно обсудим проект",
        durationMinutes: 60,
      },
    ],
  };
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path);
    const first = await listMeetingTypes({
      client: createClient({ baseUrl: backend.url }),
      throwOnError: true,
    });
    expect(first.response.status).toBe(200);
    expect(first.data).toEqual(expected);
    await backend.stop();
    backend = await startBackend(database.path);
    const restarted = await listMeetingTypes({
      client: createClient({ baseUrl: backend.url }),
      throwOnError: true,
    });
    expect(restarted.response.status).toBe(200);
    expect(restarted.data).toEqual(expected);
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});
