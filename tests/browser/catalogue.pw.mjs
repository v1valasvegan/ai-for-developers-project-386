import { test, expect } from "@playwright/test";
import { startBackend, startFrontend, temporaryDatabase } from "../support/servers.mjs";
import { prepareCatalogue } from "../support/catalogue-fixture.mjs";

test("a guest follows the homepage link to the real SQLite catalogue and can return home", async ({
  page,
}) => {
  const database = await temporaryDatabase();
  let backend;
  let frontend;
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    frontend = await startFrontend(backend.url);
    await page.goto(frontend.url);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("для вашего звонка");
    await page.getByRole("link", { name: "Перейти к записи" }).click();
    await expect(page).toHaveURL(`${frontend.url}/book`);
    await expect(page.getByRole("heading", { name: "Знакомство", exact: true })).toBeVisible();
    const catalogue = page.getByRole("list", { name: "Типы встреч" });
    await expect(catalogue.getByRole("heading")).toHaveText(["Знакомство", "Разбор проекта"]);
    await expect(catalogue).toContainText("Обсудим ваш вопрос");
    await expect(catalogue).toContainText("30 минут");
    await expect(catalogue).toContainText("Подробно обсудим проект");
    await expect(catalogue).toContainText("60 минут");
    await page.getByRole("button", { name: "Выбрать Знакомство" }).click();
    await page.getByLabel("Часовой пояс", { exact: true }).selectOption("Europe/Moscow");
    await expect(page.getByRole("heading", { name: "Выберите день и время" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "10:00–10:30", exact: true }).click();
    const selectionUrl = page.url();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Время выбрано" })).toBeVisible();
    await expect(page).toHaveURL(selectionUrl);
    await page.getByLabel("Часовой пояс", { exact: true }).selectOption("America/Los_Angeles");
    await expect(page).toHaveURL(selectionUrl);
    await expect(
      page.getByText("10 ноября 2026 г. · 23:00–23:30 · America/Los_Angeles", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Назад", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Выберите день и время" })).toBeVisible();
    await page.getByRole("button", { name: "Назад", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Знакомство", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole("link", { name: "Вернуться на главную" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("для вашего звонка");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    await frontend?.stop();
    await backend?.stop();
    await database.cleanup();
  }
});
