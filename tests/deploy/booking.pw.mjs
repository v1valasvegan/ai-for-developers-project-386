import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "../../frontend/src/api/generated/client/index";
import {
  createBooking,
  getHealth,
  listBookings,
  listMeetingTypes,
  listMeetingTypeSlots,
} from "../../frontend/src/api/generated/sdk.gen";

const time = (instant) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
const date = (instant) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(instant));

async function createType(page, id, title, duration) {
  await page.goto("/owner");
  await page.getByRole("tab", { name: "Типы встреч" }).click();
  await page.getByRole("textbox", { name: "Код типа встречи" }).fill(id);
  await page.getByRole("textbox", { name: "Название", exact: true }).fill(title);
  await page
    .getByRole("textbox", { name: "Описание", exact: true })
    .fill("Синтетические данные проверки деплоя");
  await page.getByRole("spinbutton", { name: "Длительность, минут" }).fill(String(duration));
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/meeting-types") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Создать тип встречи", exact: true }).click();
  expect((await created).status()).toBe(201);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}

async function assertStored(client, state) {
  const types = await listMeetingTypes({ client, throwOnError: true });
  expect(types.data.items.map((t) => t.id)).toEqual(
    expect.arrayContaining([state.longId, state.shortId]),
  );
  const meetings = await listBookings({ client, throwOnError: true });
  const active = Date.parse(meetings.data.serverTime) < Date.parse(state.booking.endsAt);
  expect(meetings.data.items.filter((b) => b.email === state.attempt.email)).toEqual(
    active ? [expect.objectContaining(state.booking)] : [],
  );
  const replay = await createBooking({ client, body: state.attempt });
  expect(replay.response.status).toBe(200);
  expect(replay.data).toEqual(state.booking);
  return active;
}

async function assertCurrentConflict(client, state) {
  const duplicate = await createBooking({
    client,
    body: { ...state.attempt, idempotencyKey: randomUUID() },
  });
  expect(duplicate.response.status).toBe(409);
  expect(duplicate.error.code).toBe("slot_conflict");
  const overlap = await createBooking({
    client,
    body: {
      ...state.attempt,
      meetingTypeId: state.shortId,
      startsAt: new Date(Date.parse(state.attempt.startsAt) + 30 * 60000).toISOString(),
      idempotencyKey: randomUUID(),
    },
  });
  expect(overlap.response.status).toBe(409);
  expect(overlap.error.code).toBe("slot_conflict");
  const slots = await listMeetingTypeSlots({
    client,
    path: { id: state.shortId },
    throwOnError: true,
  });
  expect(
    slots.data.items.some((s) => Date.parse(s.startsAt) === Date.parse(state.attempt.startsAt)),
  ).toBe(false);
  expect(slots.data.occupied).toContainEqual({
    startsAt: state.booking.startsAt,
    endsAt: state.booking.endsAt,
  });
}

test("deployed image: real guest, owner, cross-type conflict and persistent idempotency", async ({
  page,
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Задайте BASE_URL проверяемого приложения");
  const base = new URL(baseURL);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/"
  ) {
    throw new Error("BASE_URL должен быть HTTP(S) origin без credentials и вложенного пути");
  }
  const client = createClient({ baseUrl: base.origin });
  await expect
    .poll(
      async () => {
        try {
          const health = await getHealth({ client, signal: AbortSignal.timeout(3000) });
          return health.data?.status;
        } catch {
          return "not-ready";
        }
      },
      { timeout: 60000 },
    )
    .toBe("ok");

  let state;
  if (process.env.SMOKE_MODE === "verify") {
    if (!process.env.SMOKE_STATE_FILE)
      throw new Error("Для проверки сохранности нужен SMOKE_STATE_FILE");
    state = JSON.parse(await readFile(process.env.SMOKE_STATE_FILE, "utf8"));
  } else {
    const run = randomUUID().slice(0, 8);
    const longId = `smoke-60-${run}`;
    const shortId = `smoke-30-${run}`;
    const title = `Проверка60 ${run}`;
    await createType(page, longId, title, 60);
    await createType(page, shortId, `Проверка30 ${run}`, 30);
    const available = await listMeetingTypeSlots({
      client,
      path: { id: longId },
      throwOnError: true,
    });
    expect(available.data.items.length).toBeGreaterThan(0);
    const slot = available.data.items[0];

    await page.goto("/book");
    await page.getByRole("button", { name: `Выбрать ${title}`, exact: true }).click();
    await expect(page.getByRole("table", { name: "Календарь записи" })).toBeVisible();
    await page.getByLabel("Часовой пояс", { exact: true }).selectOption("Europe/Moscow");
    await page.getByRole("button", { name: date(slot.startsAt), exact: true }).click();
    await page
      .getByRole("button", { name: `${time(slot.startsAt)}–${time(slot.endsAt)}`, exact: true })
      .click();
    await page.getByLabel("Имя", { exact: true }).fill(`Проверка ${run}`);
    await page.getByLabel("Email", { exact: true }).fill(`smoke-${run}@example.com`);

    const competing = await browser.newContext({ baseURL, timezoneId: "Europe/Moscow" });
    try {
      const other = await competing.newPage();
      await other.goto(`/book/${longId}?startsAt=${encodeURIComponent(slot.startsAt)}`);
      await other.getByLabel("Имя", { exact: true }).fill("Проверка конфликта");
      await other.getByLabel("Email", { exact: true }).fill(`conflict-${run}@example.com`);
      const created = page.waitForResponse(
        (r) => r.url().endsWith("/api/bookings") && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Подтвердить запись", exact: true }).click();
      const response = await created;
      expect(response.status()).toBe(201);
      state = {
        longId,
        shortId,
        attempt: response.request().postDataJSON(),
        booking: await response.json(),
      };
      await expect(
        page.getByRole("heading", { name: "Запись подтверждена", exact: true }),
      ).toBeVisible();
      const rejected = other.waitForResponse(
        (r) => r.url().endsWith("/api/bookings") && r.request().method() === "POST",
      );
      await other.getByRole("button", { name: "Подтвердить запись", exact: true }).click();
      expect((await rejected).status()).toBe(409);
      await expect(other.getByRole("alert")).toContainText("Это время уже заняли. Выберите другое");
    } finally {
      await competing.close();
    }
  }

  const active = await assertStored(client, state);
  const verify = process.env.SMOKE_MODE === "verify";
  if (!verify) {
    expect(active).toBe(true);
    await assertCurrentConflict(client, state);
  }
  await page.goto("/owner");
  const meetings = page.getByRole("list", { name: "Текущие и предстоящие встречи" });
  await expect(page.getByRole("tab", { name: "Встречи", exact: true })).toBeVisible();
  if (active) await expect(meetings.getByText(state.attempt.email, { exact: true })).toBeVisible();
  else await expect(page.getByText(state.attempt.email, { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expect(page.getByRole("tab", { name: "Встречи", exact: true })).toBeVisible();
  if (active) await expect(meetings.getByText(state.attempt.email, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Проверяем текущую доступность только в create. После рестарта прежний
  // слот может уже выйти из скользящего окна, не перестав храниться в SQLite.
  if (!verify) {
    await page.goto(`/book/${state.shortId}`);
    await expect(page.getByRole("table", { name: "Календарь записи" })).toBeVisible();
    await page.getByLabel("Часовой пояс", { exact: true }).selectOption("Europe/Moscow");
    await page.getByRole("button", { name: date(state.booking.startsAt), exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: `${time(state.booking.startsAt)}–${time(state.booking.endsAt)} · Занято`,
        exact: true,
      }),
    ).toBeDisabled();
  }

  if (process.env.SMOKE_STATE_FILE) {
    await mkdir(dirname(process.env.SMOKE_STATE_FILE), { recursive: true });
    await writeFile(process.env.SMOKE_STATE_FILE, JSON.stringify(state, null, 2));
  }
});
