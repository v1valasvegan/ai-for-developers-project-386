import { randomUUID } from "node:crypto";
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

async function createType(request, backend, index) {
  const response = await request.post(`${backend.url}/api/meeting-types`, {
    data: {
      id: `type-${String(index).padStart(2, "0")}`,
      title: `Встреча ${index + 1}`,
      description: "Обсудим ваш проект",
      durationMinutes: 15,
    },
  });
  expect(response.status()).toBe(201);
}

test("compact catalogue separates actions, styles the selector and keeps Back and header visible", async ({
  page,
  request,
}) => {
  await setup(async (backend, frontend) => {
    await createType(request, backend, 0);
    await createType(request, backend, 1);
    await page.goto(`${frontend.url}/book`);
    const cards = page.getByRole("list", { name: "Типы встреч" }).getByRole("listitem");
    await expect(cards).toHaveCount(2);
    for (const card of await cards.all()) {
      expect((await card.boundingBox()).height).toBeLessThan(210);
    }
    const first = await page
      .getByRole("button", { name: "Выбрать тип встречи", exact: true })
      .boundingBox();
    const second = await page
      .getByRole("button", { name: "Выбрать дату и время", exact: true })
      .boundingBox();
    expect(
      Math.max(second.x - first.x - first.width, second.y - first.y - first.height),
    ).toBeGreaterThanOrEqual(12);
    const zone = page.getByRole("combobox", { name: "Часовой пояс" });
    await expect(zone).toHaveCSS("appearance", "none");
    await expect(zone).not.toHaveCSS("background-image", "none");
    const favicon = page.locator('link[rel="icon"]');
    await expect(favicon).toHaveAttribute("href", "/favicon.svg");
    const icon = await request.get(`${frontend.url}/favicon.svg`);
    expect(icon.ok()).toBe(true);
    expect(await icon.text()).toContain("<svg");
    await page.getByRole("button", { name: "Выбрать Встреча 1", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Выберите день и время" })).toBeVisible();
    const back = page.getByRole("button", { name: "Назад", exact: true });
    expect((await back.boundingBox()).y).toBeLessThan(600);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => (await page.locator(".site-header").boundingBox()).y).toBe(0);
    await expect.poll(async () => (await back.boundingBox()).y).toBeGreaterThanOrEqual(0);
    const backBox = await back.boundingBox();
    expect(backBox.y + backBox.height).toBeLessThan(page.viewportSize().height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await back.click();
    await expect(
      page.getByRole("button", { name: "Выбрать тип встречи", exact: true }),
    ).toBeVisible();
  });
});

test("long meeting and type lists scroll internally and remain keyboard accessible", async ({
  page,
  request,
}) => {
  await setup(async (backend, frontend) => {
    for (let index = 0; index < 14; index += 1) {
      await createType(request, backend, index);
      const response = await request.post(`${backend.url}/api/bookings`, {
        data: {
          meetingTypeId: `type-${String(index).padStart(2, "0")}`,
          startsAt: new Date(Date.parse("2026-11-11T07:00:00Z") + index * 15 * 60000).toISOString(),
          name: `Гость ${index + 1}`,
          email: `guest${index + 1}@example.com`,
          idempotencyKey: randomUUID(),
        },
      });
      expect(response.status()).toBe(201);
    }
    await page.goto(`${frontend.url}/owner`);
    const meetings = page.getByRole("list", { name: "Текущие и предстоящие встречи" });
    await expect(meetings.getByRole("listitem")).toHaveCount(14);
    const meetingScroll = page.getByRole("region", { name: "Прокрутка встреч" });
    expect(await meetingScroll.evaluate((list) => list.scrollHeight > list.clientHeight)).toBe(
      true,
    );
    await meetingScroll.focus();
    await page.keyboard.press("End");
    await expect.poll(() => meetingScroll.evaluate((list) => list.scrollTop)).toBeGreaterThan(0);
    await page.getByRole("tab", { name: "Типы встреч" }).click();
    const types = page.getByRole("list", { name: "Типы встреч" });
    await expect(types.getByRole("listitem")).toHaveCount(14);
    const typeScroll = page.getByRole("region", { name: "Прокрутка типов встреч" });
    expect(await typeScroll.evaluate((list) => list.scrollHeight > list.clientHeight)).toBe(true);
    await typeScroll.focus();
    await page.keyboard.press("End");
    await expect.poll(() => typeScroll.evaluate((list) => list.scrollTop)).toBeGreaterThan(0);
    await expect(typeScroll).toHaveAttribute("tabindex", "0");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
});

test("creation notification disappears after five seconds and a second creation starts a fresh timeout", async ({
  page,
}) => {
  await setup(async (_backend, frontend) => {
    await page.goto(`${frontend.url}/owner`);
    await page.getByRole("tab", { name: "Типы встреч" }).click();
    await page.clock.install();
    for (let index = 0; index < 2; index += 1) {
      await page.getByRole("textbox", { name: "Код типа встречи" }).fill(`new-${index}`);
      await page.getByRole("textbox", { name: "Название" }).fill(`Новый тип ${index}`);
      await page.getByRole("textbox", { name: "Описание" }).fill("Обсудим проект");
      await page.getByRole("button", { name: "Создать тип встречи", exact: true }).click();
      const notice = page.getByRole("status", { name: "Уведомление", exact: true });
      await expect(notice).toContainText("Тип встречи создан");
      await expect(
        notice.getByRole("button", { name: "Закрыть уведомление", exact: true }),
      ).toBeVisible();
      await expect(notice).toHaveCSS("position", "fixed");
      const box = await notice.boundingBox();
      if (page.viewportSize().width > 600) {
        expect(Math.abs(page.viewportSize().width - box.x - box.width - 24)).toBeLessThan(1);
        expect(box.y).toBeLessThan(160);
      } else {
        expect(Math.abs(page.viewportSize().height - box.y - box.height - 16)).toBeLessThan(1);
      }
      await page.clock.fastForward(4000);
      await expect(notice).toBeVisible();
      if (index === 1)
        await notice.getByRole("button", { name: "Закрыть уведомление", exact: true }).click();
      else await page.clock.fastForward(1500);
      await expect(notice).toHaveCount(0);
    }
  });
});
