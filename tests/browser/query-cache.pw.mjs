import { test, expect } from "@playwright/test";
import { startBackend, startFrontend, temporaryDatabase } from "../support/servers.mjs";

test("fresh catalogue is reused across steps while availability is revalidated and timezone stays presentation-only", async ({
  page,
  request,
}) => {
  const database = await temporaryDatabase();
  let backend;
  let frontend;
  try {
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    frontend = await startFrontend(backend.url);
    expect(
      (
        await request.post(`${backend.url}/api/meeting-types`, {
          data: {
            id: "intro-30",
            title: "Знакомство",
            description: "Обсудим проект",
            durationMinutes: 30,
          },
        })
      ).status(),
    ).toBe(201);
    let catalogueReads = 0;
    let slotReads = 0;
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() !== "GET") return;
      if (path === "/api/meeting-types") catalogueReads += 1;
      if (path === "/api/meeting-types/intro-30/slots") slotReads += 1;
    });
    await page.goto(`${frontend.url}/book`);
    await page.getByRole("button", { name: "Выбрать Знакомство" }).click();
    await expect(page.getByRole("heading", { name: "Выберите день и время" })).toBeVisible();
    expect(catalogueReads).toBe(1);
    expect(slotReads).toBe(1);
    await page.getByRole("combobox", { name: "Часовой пояс" }).selectOption("UTC");
    expect(slotReads).toBe(1);
    await page.getByRole("button", { name: "Назад", exact: true }).click();
    await page.getByRole("button", { name: "Выбрать Знакомство" }).click();
    await expect(page.getByRole("heading", { name: "Выберите день и время" })).toBeVisible();
    expect(catalogueReads).toBe(1);
    expect(slotReads).toBe(2);
  } finally {
    await frontend?.stop();
    await backend?.stop();
    await database.cleanup();
  }
});
