import { test, expect } from "@playwright/test";
import { startBackend, startFrontend, temporaryDatabase } from "../support/servers.mjs";

test("an owner creates a type and a guest reads it from the real catalogue", async ({ page }) => {
  const database = await temporaryDatabase();
  let backend;
  let frontend;
  try {
    backend = await startBackend(database.path);
    frontend = await startFrontend(backend.url);
    await page.goto(frontend.url);
    await page.getByRole("link", { name: "Управление", exact: true }).click();
    await expect(page).toHaveURL(`${frontend.url}/owner`);
    await page.getByRole("tab", { name: "Типы встреч" }).click();
    await expect(page.getByText("Пока нет доступных типов встреч")).toBeVisible();
    await page.getByRole("textbox", { name: "Код типа встречи" }).fill(" --Intro------30-- ");
    await expect(page.getByText("Будет сохранён код: intro-30")).toBeVisible();
    await page.getByRole("textbox", { name: "Название" }).fill("<b>Знакомство</b>");
    await page.getByRole("textbox", { name: "Описание" }).fill("<img src=x onerror=alert('HTML')>");
    await page.getByRole("spinbutton", { name: "Длительность, минут" }).fill("30");
    await page.getByRole("button", { name: "Создать тип встречи" }).click();
    await expect(page.getByText("Тип встречи создан")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Типы встреч" }).getByText("intro-30", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Код типа встречи" })).toHaveValue("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("link", { name: "Записаться", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "<b>Знакомство</b>", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("<img src=x onerror=alert('HTML')>", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("30 минут", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Типы встреч" }).locator("b, img, script"),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "<b>Знакомство</b>", exact: true }),
    ).toBeVisible();
  } finally {
    await frontend?.stop();
    await backend?.stop();
    await database.cleanup();
  }
});
