import { test, expect } from "@playwright/test";
import { startBackend, startFrontend, temporaryDatabase } from "../support/servers.mjs";

async function setup(run) {
  const database = await temporaryDatabase();
  let backend;
  let frontend;
  try {
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    frontend = await startFrontend(backend.url);
    await run(backend, frontend);
  } finally {
    await frontend?.stop();
    await backend?.stop();
    await database.cleanup();
  }
}
async function createType(page, frontend) {
  await page.goto(`${frontend.url}/owner`);
  await page.getByRole("textbox", { name: "Код типа встречи" }).fill("intro-30");
  await page.getByRole("textbox", { name: "Название" }).fill("Знакомство");
  await page.getByRole("textbox", { name: "Описание" }).fill("Обсудим вопрос");
  await page.getByRole("spinbutton", { name: "Длительность, минут" }).fill("30");
  await page.getByRole("button", { name: "Создать тип встречи" }).click();
  await expect(page.getByText("Тип встречи создан")).toBeVisible();
}
async function choose(page, frontend) {
  await page.goto(`${frontend.url}/book`);
  await page.getByRole("button", { name: "Выбрать Знакомство" }).click();
  await page.getByLabel("Часовой пояс", { exact: true }).selectOption("Europe/Moscow");
  await page.getByRole("button", { name: "10:00–10:30", exact: true }).click();
  await page.getByLabel("Имя", { exact: true }).fill("Анна");
  await page.getByLabel("Email", { exact: true }).fill("Anna@Example.com");
}

test("owner creates a type, guest books and complete confirmation matches the real owner API", async ({
  page,
}) => {
  await setup(async (backend, frontend) => {
    await createType(page, frontend);
    await choose(page, frontend);
    await page.getByRole("button", { name: "Назад", exact: true }).click();
    await page.getByRole("button", { name: "10:15–10:45", exact: true }).click();
    await expect(page.getByLabel("Имя", { exact: true })).toHaveValue("Анна");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("Anna@Example.com");
    expect(
      (await page.getByLabel("Имя", { exact: true }).boundingBox()).height,
    ).toBeGreaterThanOrEqual(44);
    expect(
      (await page.getByLabel("Email", { exact: true }).boundingBox()).height,
    ).toBeGreaterThanOrEqual(44);
    await page.getByRole("button", { name: "Подтвердить запись" }).click();
    await expect(page.getByRole("heading", { name: "Запись подтверждена" })).toBeVisible();
    await expect(
      page.getByText("11 ноября 2026 г. · 10:15–10:45 · Europe/Moscow", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Анна · Anna@Example.com", { exact: true })).toBeVisible();
    const list = await fetch(`${backend.url}/api/bookings`).then((r) => r.json());
    expect(list.items).toEqual([
      expect.objectContaining({
        name: "Анна",
        email: "Anna@Example.com",
        meetingTypeTitle: "Знакомство",
        startsAt: "2026-11-11T07:15:00Z",
        endsAt: "2026-11-11T07:45:00Z",
        status: "upcoming",
      }),
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("Ссылка неверна или устарела");
    await expect(page.getByRole("heading", { name: "Запись подтверждена" })).toHaveCount(0);
    expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toHaveLength(
      1,
    );
  });
});

test("a conflict after selection returns to fresh availability without losing guest data", async ({
  page,
  request,
}) => {
  await setup(async (backend, frontend) => {
    await createType(page, frontend);
    await choose(page, frontend);
    const concurrent = await request.post(`${backend.url}/api/bookings`, {
      data: {
        meetingTypeId: "intro-30",
        startsAt: "2026-11-11T07:00:00Z",
        name: "Другой гость",
        email: "other@example.com",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
      },
    });
    expect(concurrent.status()).toBe(201);
    await page.getByRole("button", { name: "Подтвердить запись" }).click();
    await expect(page.getByRole("alert")).toContainText("Это время уже заняли");
    await expect(page.getByRole("button", { name: "10:00–10:30", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "10:30–11:00", exact: true }).click();
    await expect(page.getByLabel("Имя", { exact: true })).toHaveValue("Анна");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("Anna@Example.com");
    await page.getByRole("button", { name: "Подтвердить запись" }).click();
    await expect(page.getByRole("heading", { name: "Запись подтверждена" })).toBeVisible();
    expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toHaveLength(
      2,
    );
  });
});

test("real response loss retries the exact attempt after midnight without creating a duplicate", async ({
  page,
}) => {
  await setup(async (backend, frontend) => {
    await createType(page, frontend);
    await choose(page, frontend);
    const attempts = [];
    await page.route("**/api/bookings", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      attempts.push(route.request().postDataJSON());
      const response = await route.fetch();
      if (attempts.length === 1) {
        expect(response.status()).toBe(201);
        await route.abort("connectionreset");
      } else {
        expect(response.status()).toBe(200);
        await route.fulfill({ response });
      }
    });
    await page.getByRole("button", { name: "Подтвердить запись" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Не удалось получить подтверждение. Запись могла создаться. Повторите отправку",
    );
    await backend.setTime("2026-11-10T21:00:00Z");
    await page.getByLabel("Часовой пояс", { exact: true }).selectOption("UTC");
    await page.getByRole("button", { name: "Повторить", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Запись подтверждена" })).toBeVisible();
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
    expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toHaveLength(
      1,
    );
    await page.unroute("**/api/bookings");
  });
});
