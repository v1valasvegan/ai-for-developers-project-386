import { test, expect } from "@playwright/test";
import { startBackend, startFrontend, temporaryDatabase } from "../support/servers.mjs";

test("time-first guest uses Back and F5, chooses a compatible type and books through the real server", async ({
  page,
  request,
}) => {
  const database = await temporaryDatabase();
  let backend;
  let frontend;
  try {
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    frontend = await startFrontend(backend.url);
    for (const type of [
      { id: "intro-30", title: "Знакомство", description: "Обсудим вопрос", durationMinutes: 30 },
      {
        id: "review-60",
        title: "Разбор проекта",
        description: "Подробный разбор",
        durationMinutes: 60,
      },
    ]) {
      expect(
        (await request.post(`${backend.url}/api/meeting-types`, { data: type })).status(),
      ).toBe(201);
    }
    await page.goto(`${frontend.url}/book`);
    await page.getByRole("button", { name: "Выбрать дату и время", exact: true }).click();
    await page.getByLabel("Часовой пояс", { exact: true }).selectOption("Europe/Moscow");
    await expect(
      page.getByRole("button", { name: "11 ноября 2026 г.", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "17:30", exact: true }).click();
    await expect(page.getByRole("button", { name: "Выбрать Разбор проекта" })).toHaveCount(0);
    await expect(
      page.getByText("Выбранное начало: 11 ноября 2026 г. · 17:30 · Europe/Moscow"),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Выбрать Знакомство" })).toBeVisible();
    await page.getByLabel("Часовой пояс", { exact: true }).selectOption("Europe/Moscow");
    await page.getByRole("button", { name: "Назад", exact: true }).click();
    await page.getByRole("button", { name: "10:00", exact: true }).click();
    await page.getByRole("button", { name: "Выбрать Разбор проекта" }).click();
    await page.getByLabel("Имя", { exact: true }).fill("Анна");
    await page.getByLabel("Email", { exact: true }).fill("anna@example.com");
    await page.getByRole("button", { name: "Назад", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Выберите тип встречи" })).toBeVisible();
    await page.getByRole("button", { name: "Выбрать Знакомство" }).click();
    await expect(page.getByLabel("Имя", { exact: true })).toHaveValue("Анна");
    await page.reload();
    await expect(page.getByLabel("Имя", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
    await page.getByLabel("Часовой пояс", { exact: true }).selectOption("Europe/Moscow");
    await page.getByLabel("Имя", { exact: true }).fill("Анна");
    await page.getByLabel("Email", { exact: true }).fill("anna@example.com");
    await page.getByRole("button", { name: "Подтвердить запись" }).click();
    await expect(page.getByRole("heading", { name: "Запись подтверждена" })).toBeVisible();
    await expect(
      page.getByText("11 ноября 2026 г. · 10:00–10:30 · Europe/Moscow", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Анна · anna@example.com", { exact: true })).toBeVisible();
    expect(
      (await request.get(`${backend.url}/api/bookings`).then((response) => response.json())).items,
    ).toEqual([
      expect.objectContaining({
        meetingTypeId: "intro-30",
        startsAt: "2026-11-11T07:00:00Z",
        endsAt: "2026-11-11T07:30:00Z",
        name: "Анна",
        email: "anna@example.com",
      }),
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("Ссылка неверна или устарела");
  } finally {
    await frontend?.stop();
    await backend?.stop();
    await database.cleanup();
  }
});
