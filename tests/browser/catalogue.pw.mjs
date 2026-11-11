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
    backend = await startBackend(database.path);
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
    await page.reload();
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
