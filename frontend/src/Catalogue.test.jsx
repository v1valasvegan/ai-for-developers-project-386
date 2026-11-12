// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import App from "./App";
import { client } from "./api/generated/client.gen";
import { startBackend, temporaryDatabase } from "../../tests/support/servers.mjs";
import { prepareCatalogue } from "../../tests/support/catalogue-fixture.mjs";
import { prepareSlots } from "../../tests/support/slots-fixture.mjs";

// jsdom has no viewport media-query implementation; catalogue behaviour does not depend on it.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (media) => ({
    media,
    matches: false,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }),
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/book");
});

test("a guest chooses a type then a date and time, and Back requires a fresh time choice", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    client.setConfig({ baseUrl: backend.url });
    window.history.replaceState(null, "", "/book");
    const guest = userEvent.setup();
    render(
      <MantineProvider env="test">
        <App path="/book" />
      </MantineProvider>,
    );
    await guest.click(await screen.findByRole("button", { name: "Выбрать Знакомство" }));
    expect(await screen.findByRole("heading", { name: "Выберите день и время" })).toBeVisible();
    await screen.findByRole("table", { name: "Календарь записи" });
    expect(screen.getByRole("heading", { name: "Знакомство", exact: true })).toBeVisible();
    expect(screen.getByText("◷ 30 минут")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Выбрать Разбор проекта" }),
    ).not.toBeInTheDocument();
    await guest.selectOptions(screen.getByLabelText("Часовой пояс"), "Europe/Moscow");
    expect(screen.getByLabelText("Часовой пояс")).toHaveValue("Europe/Moscow");
    expect(screen.getByRole("button", { name: "14 ноября 2026 г." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "11 ноября 2026 г." })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.location.pathname).toBe("/book/intro-30");
    expect(window.location.search).toBe("");
    await guest.click(screen.getByRole("button", { name: "10:00–10:30" }));
    expect(await screen.findByRole("heading", { name: "Время выбрано" })).toBeVisible();
    expect(new URLSearchParams(window.location.search).get("startsAt")).toBe(
      "2026-11-11T07:00:00Z",
    );
    await guest.click(screen.getByRole("button", { name: "Назад" }));
    expect(await screen.findByRole("button", { name: "10:00–10:30" })).toBeVisible();
    await guest.click(screen.getByRole("button", { name: "Назад" }));
    await guest.click(await screen.findByRole("button", { name: "Выбрать Разбор проекта" }));
    expect(await screen.findByRole("button", { name: "10:00–11:00" })).toBeVisible();
    expect(window.location.pathname).toBe("/book/review-60");
    expect(window.location.search).toBe("");
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("the calendar shows a real occupied interval of another type without guest details, and keeps free adjacent time selectable", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    const response = await fetch(`${backend.url}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingTypeId: "intro-30",
        startsAt: "2026-11-11T11:00:00Z",
        name: "Скрытый гость",
        email: "private@example.com",
        idempotencyKey: "00000000-0000-4000-8000-000000000033",
      }),
    });
    expect(response.status).toBe(201);
    client.setConfig({ baseUrl: backend.url });
    window.history.replaceState(null, "", "/book/review-60");
    render(
      <MantineProvider env="test">
        <App path="/book/review-60" />
      </MantineProvider>,
    );
    const guest = userEvent.setup();
    await screen.findByRole("heading", { name: "Выберите день и время" });
    const calendar = await screen.findByRole("table", { name: "Календарь записи" });
    await guest.selectOptions(screen.getByLabelText("Часовой пояс"), "Europe/Moscow");
    expect(screen.getByLabelText("Часовой пояс")).toHaveValue("Europe/Moscow");
    expect(
      within(calendar)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]);
    expect(screen.getByRole("button", { name: "14:00–14:30 · Занято" })).toBeDisabled();
    expect(screen.queryByText("Скрытый гость")).not.toBeInTheDocument();
    expect(screen.queryByText("private@example.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "14:00–15:00" })).not.toBeInTheDocument();
    await guest.click(screen.getByRole("button", { name: "14:30–15:30" }));
    expect(await screen.findByLabelText("Имя", { exact: true })).toHaveValue("");
    expect(new URLSearchParams(window.location.search).get("startsAt")).toBe(
      "2026-11-11T11:30:00Z",
    );
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("availability loading and failure are not empty results, and retry reaches real empty availability", async () => {
  const database = await temporaryDatabase();
  let backend;
  const network = setupServer();
  try {
    await prepareSlots(database.path, {
      occupied: [["2026-11-10T21:00:00Z", "2026-11-24T21:00:00Z"]],
    });
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    client.setConfig({ baseUrl: backend.url });
    network.use(
      http.get(
        `${backend.url}/api/meeting-types/intro-30/slots`,
        () =>
          HttpResponse.json(
            { code: "storage_unavailable", message: "Недоступно" },
            { status: 503 },
          ),
        { once: true },
      ),
    );
    network.listen({ onUnhandledRequest: "bypass" });
    render(
      <MantineProvider env="test">
        <App path="/book/intro-30" />
      </MantineProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Загружаем свободное время");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось загрузить свободное время",
    );
    expect(
      screen.queryByText("На ближайшие 14 дней свободного времени нет"),
    ).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("На ближайшие 14 дней свободного времени нет")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  } finally {
    network.close();
    await backend?.stop();
    await database.cleanup();
  }
});

test("a direct offset link restores only the instant, and changing timezone can show Moscow tomorrow as today", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    client.setConfig({ baseUrl: backend.url });
    const link = "/book/intro-30?startsAt=2026-11-11T10%3A00%3A00%2B03%3A00";
    window.history.replaceState(null, "", link);
    const guest = userEvent.setup();
    const mounted = render(
      <MantineProvider env="test">
        <App path="/book/intro-30" />
      </MantineProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Время выбрано" })).toBeVisible();
    await guest.selectOptions(screen.getByLabelText("Часовой пояс"), "America/Los_Angeles");
    expect(screen.getByText("10 ноября 2026 г. · 23:00–23:30 · America/Los_Angeles")).toBeVisible();
    expect(window.location.pathname + window.location.search).toBe(link);
    mounted.unmount();
    // F5 opens a fresh screen and revalidates using the new server window.
    await backend.setTime("2026-11-10T21:00:00Z");
    render(
      <MantineProvider env="test">
        <App path="/book/intro-30" />
      </MantineProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Ссылка неверна или устарела");
    expect(screen.queryByRole("heading", { name: "Время выбрано" })).not.toBeInTheDocument();
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test.each([
  "/book/missing",
  "/book/intro-30?startsAt=2026-11-11T07:00:00",
  "/book/intro-30?startsAt=2026-11-11T07:07:00Z",
  "/book/intro-30?startsAt=2026-11-11T07:15:01Z",
])("an unavailable or invalid direct link explains how to return: %s", async (link) => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    client.setConfig({ baseUrl: backend.url });
    window.history.replaceState(null, "", link);
    render(
      <MantineProvider env="test">
        <App path={window.location.pathname} />
      </MantineProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Ссылка неверна или устарела");
    expect(screen.getByRole("button", { name: "Вернуться к выбору" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Время выбрано" })).not.toBeInTheDocument();
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("an impossible calendar date in a direct link is rejected, not silently changed to another day", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path, { time: "2026-11-30T12:00:00Z" });
    client.setConfig({ baseUrl: backend.url });
    window.history.replaceState(null, "", "/book/intro-30?startsAt=2026-11-31T07:00:00Z");
    render(
      <MantineProvider env="test">
        <App path="/book/intro-30" />
      </MantineProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Ссылка неверна или устарела");
    await userEvent.setup().click(screen.getByRole("button", { name: "Вернуться к выбору" }));
    expect(await screen.findByRole("button", { name: "Выбрать Знакомство" })).toBeVisible();
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("a failed load explains the error and a guest can retry against the real catalogue", async () => {
  const database = await temporaryDatabase();
  let backend;
  const network = setupServer();
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path);
    client.setConfig({ baseUrl: backend.url });
    network.use(
      http.get(
        `${backend.url}/api/meeting-types`,
        () =>
          HttpResponse.json(
            {
              code: "storage_unavailable",
              message: "Хранилище временно недоступно",
            },
            { status: 503 },
          ),
        { once: true },
      ),
    );
    network.listen({ onUnhandledRequest: "bypass" });
    const guest = userEvent.setup();
    render(
      <MantineProvider env="test" forceColorScheme="light">
        <App path="/book" />
      </MantineProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить типы встреч");
    expect(screen.queryByText("Пока нет доступных типов встреч")).not.toBeInTheDocument();
    await guest.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByRole("heading", { name: "Знакомство" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  } finally {
    network.close();
    await backend?.stop();
    await database.cleanup();
  }
});

test("a guest reads real type titles, descriptions and durations without registration", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path);
    client.setConfig({ baseUrl: backend.url });
    render(
      <MantineProvider env="test" forceColorScheme="light">
        <App path="/book/" />
      </MantineProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Знакомство" })).toBeVisible();
    expect(screen.getByText("Обсудим ваш вопрос")).toBeVisible();
    expect(screen.getByText("30 минут")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Разбор проекта" })).toBeVisible();
    expect(screen.getByText("Подробно обсудим проект")).toBeVisible();
    expect(screen.getByText("60 минут")).toBeVisible();
    expect(screen.queryByText("Пока нет доступных типов встреч")).not.toBeInTheDocument();
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});

test("a guest sees loading then the real empty catalogue, with a way home", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    backend = await startBackend(database.path);
    client.setConfig({ baseUrl: backend.url });
    render(
      <MantineProvider env="test" forceColorScheme="light">
        <App path="/book" />
      </MantineProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Загружаем типы встреч");
    expect(await screen.findByText("Пока нет доступных типов встреч")).toBeVisible();
    expect(screen.getByRole("link", { name: "Вернуться на главную" })).toHaveAttribute("href", "/");
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});
