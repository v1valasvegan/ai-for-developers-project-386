import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { startBackend, startFrontend, temporaryDatabase } from "../support/servers.mjs";

async function setup(request, run) {
  const database = await temporaryDatabase();
  let backend, frontend;
  try {
    backend = await startBackend(database.path, { time: "2026-11-12T12:00:00Z" });
    for (const [id, durationMinutes] of [
      ["intro-30", 30],
      ["review-60", 60],
      ["all-day", 480],
    ]) {
      expect(
        (
          await request.post(`${backend.url}/api/meeting-types`, {
            data: {
              id,
              title:
                id === "intro-30"
                  ? "Знакомство"
                  : id === "review-60"
                    ? "Разбор проекта"
                    : "Весь день",
              description: "Обсудим ваш проект",
              durationMinutes,
            },
          })
        ).status(),
      ).toBe(201);
    }
    frontend = await startFrontend(backend.url);
    await run(backend, frontend);
  } finally {
    await frontend?.stop();
    await backend?.stop();
    await database.cleanup();
  }
}
async function book(request, backend, meetingTypeId, startsAt) {
  expect(
    (
      await request.post(`${backend.url}/api/bookings`, {
        data: {
          meetingTypeId,
          startsAt,
          name: "Не показывать гостю",
          email: "private@example.com",
          idempotencyKey: randomUUID(),
        },
      })
    ).status(),
  ).toBe(201);
}

test("classic calendar shows actual all-type occupancy without private details in both selection orders", async ({
  page,
  request,
}) => {
  await setup(request, async (backend, frontend) => {
    await book(request, backend, "intro-30", "2026-11-13T11:00:00Z");
    const reads = [];
    page.on("request", (r) => {
      if (r.method() === "GET" && r.url().includes("/api/")) reads.push(r.url());
    });
    for (const timeFirst of [false, true]) {
      await page.goto(`${frontend.url}${timeFirst ? "/book" : "/book/review-60"}`);
      if (timeFirst)
        await page.getByRole("button", { name: "Выбрать дату и время", exact: true }).click();
      await expect(page.getByRole("table", { name: "Календарь записи" })).toBeVisible();
      await page.getByRole("combobox", { name: "Часовой пояс" }).selectOption("Europe/Moscow");
      await expect(
        page.getByRole("button", { name: "14:00–14:30 · Занято", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("region", { name: "Занятые интервалы", exact: true }),
      ).toContainText("14:00–14:30");
      await expect(page.getByText("Не показывать гостю", { exact: true })).toHaveCount(0);
      await expect(page.getByText("private@example.com", { exact: true })).toHaveCount(0);
      const about = await page.locator(".meeting-about").boundingBox();
      const month = await page.getByRole("table", { name: "Календарь записи" }).boundingBox();
      const times = await page
        .getByRole("region", { name: "Время выбранного дня", exact: true })
        .boundingBox();
      if (page.viewportSize().width > 780) {
        expect((await page.locator(".booking-calendar-card").boundingBox()).height).toBeLessThan(
          620,
        );
        expect(month.x).toBeGreaterThan(about.x + about.width);
        expect(times.x).toBeGreaterThan(month.x + month.width);
      } else {
        expect(month.y).toBeGreaterThan(about.y + about.height);
        expect(times.y).toBeGreaterThan(month.y + month.height);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page
        .getByRole("button", { name: timeFirst ? "14:30" : "14:30–15:30", exact: true })
        .click();
      if (timeFirst)
        await page.getByRole("button", { name: "Выбрать Разбор проекта", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Имя", exact: true })).toBeVisible();
      expect(new URL(page.url()).searchParams.get("startsAt")).toBe("2026-11-13T11:30:00Z");
    }
    expect(reads.some((url) => new URL(url).pathname === "/api/bookings")).toBe(false);
  });
});

test("time-first keeps an adjacent short slot when real availability responses straddle another booking", async ({
  page,
  request,
}) => {
  await setup(request, async (backend, frontend) => {
    const staleLongReady = Promise.withResolvers();
    const bookingCreated = Promise.withResolvers();
    await page.route("**/api/meeting-types/review-60/slots", async (route) => {
      const staleResponse = await route.fetch();
      staleLongReady.resolve();
      await bookingCreated.promise;
      await route.fulfill({ response: staleResponse });
    });
    await page.route("**/api/meeting-types/intro-30/slots", async (route) => {
      await staleLongReady.promise;
      await book(request, backend, "intro-30", "2026-11-13T07:30:00Z");
      bookingCreated.resolve();
      await route.continue();
    });
    await page.goto(`${frontend.url}/book`);
    await page.getByRole("button", { name: "Выбрать дату и время", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "10:30–11:00 · Занято", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "10:00", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "10:15", exact: true })).toHaveCount(0);
    await page.unroute("**/api/meeting-types/review-60/slots");
    await page.unroute("**/api/meeting-types/intro-30/slots");
    await page.getByRole("button", { name: "10:00", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Выбрать Знакомство", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Выбрать Разбор проекта", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Выбрать Весь день", exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Выбрать Знакомство", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Имя", exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("startsAt")).toBe("2026-11-13T07:00:00Z");
  });
});

test("a fully booked day can still be opened to see its occupied interval", async ({
  page,
  request,
}) => {
  await setup(request, async (backend, frontend) => {
    await book(request, backend, "all-day", "2026-11-13T07:00:00Z");
    await page.goto(`${frontend.url}/book/intro-30`);
    const day = page.getByRole("button", { name: "13 ноября 2026 г.", exact: true });
    await expect(day).toBeEnabled();
    await day.click();
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "10:00–18:00 · Занято", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("В этот день свободного времени нет", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Свободное и занятое время", exact: true })
        .getByRole("button", { disabled: false }),
    ).toHaveCount(0);
  });
});

test("month navigation stays within the server window and timezone changes preserve the instant", async ({
  page,
  request,
}) => {
  await setup(request, async (backend, frontend) => {
    await backend.setTime("2026-11-26T12:00:00Z");
    await page.goto(`${frontend.url}/book/intro-30`);
    const next = page.getByRole("button", { name: "Следующий месяц", exact: true });
    await expect(next).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Предыдущий месяц", exact: true }),
    ).toBeDisabled();
    await next.click();
    await expect(page.getByRole("heading", { name: "декабрь 2026 г.", exact: true })).toBeVisible();
    await expect(next).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "11 декабря 2026 г.", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "1 декабря 2026 г.", exact: true }).click();
    const refreshed = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/meeting-types/intro-30/slots",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await refreshed;
    await expect(
      page.getByRole("button", { name: "1 декабря 2026 г.", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("combobox", { name: "Часовой пояс" }).selectOption("Asia/Tokyo");
    await page.getByRole("button", { name: "16:00–16:30", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Имя", exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("startsAt")).toBe("2026-12-01T07:00:00Z");
  });
});
