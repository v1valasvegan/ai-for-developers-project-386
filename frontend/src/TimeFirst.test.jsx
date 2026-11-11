// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import App from "./App";
import { client } from "./api/generated/client.gen";
import { startBackend, temporaryDatabase } from "../../tests/support/servers.mjs";
import { http, HttpResponse, passthrough } from "msw";
import { setupServer } from "msw/node";
import { prepareSlots } from "../../tests/support/slots-fixture.mjs";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (media) => ({
    media,
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }),
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/book");
});

async function withBackend(run, { empty = false, occupied = [] } = {}) {
  const database = await temporaryDatabase();
  let backend;
  try {
    if (!empty) await prepareSlots(database.path, { occupied });
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    client.setConfig({ baseUrl: backend.url });
    await run(backend);
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
}
function mount(link = "/book") {
  window.history.replaceState(null, "", link);
  return render(
    <MantineProvider env="test">
      <App path={window.location.pathname} />
    </MantineProvider>,
  );
}

test.each(["/book", "/book/intro-30"])(
  "a submillisecond off-grid instant in %s is rejected instead of truncated to a free slot",
  async (path) => {
    await withBackend(async () => {
      mount(`${path}?startsAt=2026-11-11T07:00:00.0001Z`);
      expect(await screen.findByRole("alert")).toHaveTextContent("Ссылка неверна или устарела");
      expect(screen.queryByLabelText("Имя", { exact: true })).not.toBeInTheDocument();
      await userEvent.setup().click(screen.getByRole("button", { name: "Вернуться к выбору" }));
      expect(await screen.findByRole("button", { name: "Выбрать Знакомство" })).toBeVisible();
    });
  },
);

test.each([
  ["/book", "2026-11-11T07:00:00.0000000Z"],
  ["/book/intro-30", "2026-11-11T10:00:00.0000+03:00"],
])("an exact zero-fraction moment in %s remains selectable: %s", async (path, instant) => {
  await withBackend(async () => {
    mount(`${path}?startsAt=${encodeURIComponent(instant)}`);
    if (path === "/book") {
      await userEvent
        .setup()
        .click(await screen.findByRole("button", { name: "Выбрать Знакомство" }));
    }
    expect(await screen.findByLabelText("Имя", { exact: true })).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

test("a start-only invalid link explains how to recover even with an empty catalogue", async () => {
  await withBackend(
    async () => {
      mount("/book?startsAt=not-a-time");
      expect(await screen.findByRole("alert")).toHaveTextContent("Ссылка неверна или устарела");
      await userEvent.setup().click(screen.getByRole("button", { name: "Вернуться к выбору" }));
      expect(await screen.findByText("Пока нет доступных типов встреч")).toBeVisible();
    },
    { empty: true },
  );
});

test("returning from a chosen start never briefly offers stale compatible types for a different start", async () => {
  await withBackend(async (backend) => {
    mount("/book?startsAt=2026-11-11T07:00:00Z");
    const guest = userEvent.setup();
    expect(await screen.findByRole("button", { name: "Выбрать Разбор проекта" })).toBeVisible();
    await guest.click(screen.getByRole("button", { name: "Назад", exact: true }));
    await guest.selectOptions(screen.getByLabelText("Часовой пояс"), "Europe/Moscow");
    await screen.findByRole("button", { name: "17:30", exact: true });
    let release;
    const waiting = new Promise((resolve) => {
      release = resolve;
    });
    const network = setupServer(
      http.get(`${backend.url}/api/meeting-types`, async () => {
        await waiting;
        return passthrough();
      }),
    );
    network.listen({ onUnhandledRequest: "bypass" });
    try {
      await guest.click(screen.getByRole("button", { name: "17:30", exact: true }));
      expect(screen.getByRole("status")).toHaveTextContent("Загружаем свободное время");
      expect(
        screen.queryByRole("button", { name: "Выбрать Разбор проекта" }),
      ).not.toBeInTheDocument();
      release();
      expect(await screen.findByRole("button", { name: "Выбрать Знакомство" })).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Выбрать Разбор проекта" }),
      ).not.toBeInTheDocument();
    } finally {
      release();
      network.close();
    }
  });
});

test("start-only links restore the instant, while a reload revalidates availability and never restores guest data", async () => {
  await withBackend(async (backend) => {
    const mounted = mount("/book?startsAt=2026-11-11T10%3A00%3A00%2B03%3A00");
    const guest = userEvent.setup();
    await guest.click(await screen.findByRole("button", { name: "Выбрать Знакомство" }));
    await guest.type(await screen.findByLabelText("Имя", { exact: true }), "Анна");
    await guest.type(screen.getByLabelText("Email", { exact: true }), "anna@example.com");
    mounted.unmount();
    const refreshed = mount(window.location.pathname + window.location.search);
    expect(await screen.findByLabelText("Имя", { exact: true })).toHaveValue("");
    expect(screen.getByLabelText("Email", { exact: true })).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "Запись подтверждена" })).not.toBeInTheDocument();
    expect(
      (await fetch(`${backend.url}/api/bookings`).then((response) => response.json())).items,
    ).toHaveLength(0);
    refreshed.unmount();
    await backend.setTime("2026-11-10T21:00:00Z");
    mount("/book?startsAt=2026-11-11T07:00:00Z");
    expect(await screen.findByRole("alert")).toHaveTextContent("Ссылка неверна или устарела");
  });
});

test("time-first distinguishes loading, a failed per-type request, and real empty availability", async () => {
  await withBackend(
    async (backend) => {
      let release;
      const waiting = new Promise((resolve) => {
        release = resolve;
      });
      const network = setupServer(
        http.get(
          `${backend.url}/api/meeting-types/review-60/slots`,
          async () => {
            await waiting;
            return HttpResponse.json(
              { code: "storage_unavailable", message: "Недоступно" },
              { status: 503 },
            );
          },
          { once: true },
        ),
      );
      network.listen({ onUnhandledRequest: "bypass" });
      try {
        mount();
        const guest = userEvent.setup();
        await guest.click(screen.getByRole("button", { name: "Выбрать дату и время" }));
        expect(screen.getByRole("status")).toHaveTextContent("Загружаем свободное время");
        release();
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Не удалось загрузить свободное время",
        );
        expect(
          screen.queryByText("На ближайшие 14 дней свободного времени нет"),
        ).not.toBeInTheDocument();
        await guest.click(screen.getByRole("button", { name: "Повторить", exact: true }));
        expect(
          await screen.findByText("На ближайшие 14 дней свободного времени нет"),
        ).toBeVisible();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      } finally {
        release();
        network.close();
      }
    },
    { occupied: [["2026-11-10T21:00:00Z", "2026-11-24T21:00:00Z"]] },
  );
});

test("time-first unites starts but only offers types whose full duration fits", async () => {
  const database = await temporaryDatabase();
  let backend;
  try {
    await prepareSlots(database.path, {
      occupied: [["2026-11-11T08:00:00Z", "2026-11-11T15:00:00Z"]],
    });
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    client.setConfig({ baseUrl: backend.url });
    window.history.replaceState(null, "", "/book");
    render(
      <MantineProvider env="test">
        <App path="/book" />
      </MantineProvider>,
    );
    const guest = userEvent.setup();
    expect(screen.getByRole("button", { name: "Выбрать тип встречи", exact: true })).toBeVisible();
    await guest.click(screen.getByRole("button", { name: "Выбрать дату и время", exact: true }));
    await guest.selectOptions(screen.getByLabelText("Часовой пояс"), "Europe/Moscow");
    expect(await screen.findByRole("button", { name: "10:30", exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "11 ноября 2026 г." })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "14 ноября 2026 г." })).toBeDisabled();
    expect(window.location.search).toBe("");
    await guest.click(screen.getByRole("button", { name: "10:30", exact: true }));
    expect(await screen.findByRole("button", { name: "Выбрать Знакомство" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Выбрать Разбор проекта" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "10:00", exact: true })).not.toBeInTheDocument();
    expect(
      screen.getByText("Выбранное начало: 11 ноября 2026 г. · 10:30 · Europe/Moscow"),
    ).toBeVisible();
    await guest.click(screen.getByRole("button", { name: "Назад", exact: true }));
    await guest.click(await screen.findByRole("button", { name: "10:00", exact: true }));
    expect(await screen.findByRole("button", { name: "Выбрать Разбор проекта" })).toBeVisible();
    await guest.click(screen.getByRole("button", { name: "Выбрать Разбор проекта" }));
    await guest.type(await screen.findByLabelText("Имя", { exact: true }), "Анна");
    await guest.type(screen.getByLabelText("Email", { exact: true }), "anna@example.com");
    await guest.click(screen.getByRole("button", { name: "Назад", exact: true }));
    expect(await screen.findByRole("heading", { name: "Выберите тип встречи" })).toBeVisible();
    await guest.selectOptions(screen.getByLabelText("Часовой пояс"), "America/Los_Angeles");
    expect(
      screen.getByText("Выбранное начало: 10 ноября 2026 г. · 23:00 · America/Los_Angeles"),
    ).toBeVisible();
    expect(new URLSearchParams(window.location.search).get("startsAt")).toBe(
      "2026-11-11T07:00:00Z",
    );
    await guest.click(screen.getByRole("button", { name: "Выбрать Знакомство" }));
    expect(await screen.findByLabelText("Имя", { exact: true })).toHaveValue("Анна");
    expect(screen.getByLabelText("Email", { exact: true })).toHaveValue("anna@example.com");
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
});
