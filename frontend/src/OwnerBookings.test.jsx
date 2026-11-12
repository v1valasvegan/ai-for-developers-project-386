// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { bypass, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import App from "./App";
import { client } from "./api/generated/client.gen";
import { startBackend, temporaryDatabase } from "../../tests/support/servers.mjs";

// jsdom has no viewport media-query implementation.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (media) => ({ media, matches: false, addEventListener() {}, removeEventListener() {} }),
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
async function seed(backend, startsAt = "2026-11-11T07:00:00Z") {
  await fetch(`${backend.url}/api/meeting-types`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "intro-30",
      title: "Знакомство",
      description: "Обсудим вопрос",
      durationMinutes: 30,
    }),
  });
  await fetch(`${backend.url}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      meetingTypeId: "intro-30",
      startsAt,
      name: "Анна",
      email: "anna@example.com",
      idempotencyKey: "00000000-0000-4000-8000-000000000019",
    }),
  });
}
async function withOwner(run, { seeded = true, beforeRender } = {}) {
  const database = await temporaryDatabase();
  let backend;
  try {
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    if (seeded) await seed(backend);
    await beforeRender?.(backend);
    client.setConfig({ baseUrl: backend.url });
    render(
      <MantineProvider env="test" forceColorScheme="light">
        <App path="/owner" />
      </MantineProvider>,
    );
    await run(userEvent.setup(), backend);
  } finally {
    cleanup();
    await backend?.stop();
    await database.cleanup();
  }
}

test("owner opens meetings by default, sees real empty state and can reach type creation", async () => {
  await withOwner(async (owner) => {
    expect(screen.getByRole("tab", { name: "Встречи" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Анна")).toBeVisible();
    expect(screen.getByText("anna@example.com")).toBeVisible();
    expect(screen.getByText("11 ноября 2026 г. · 10:00–10:30")).toBeVisible();
    expect(screen.getByText("Предстоящая")).toBeVisible();
    expect(screen.getByText("Europe/Moscow")).toBeVisible();
    screen.getByRole("tab", { name: "Встречи" }).focus();
    await owner.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Типы встреч" })).toHaveFocus();
    expect(await screen.findByRole("heading", { name: "Знакомство" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Код типа встречи" })).toBeVisible();
  });
});

test("server exact start marks ongoing and exact end removes the meeting on manual refresh", async () => {
  await withOwner(
    async (owner, backend) => {
      expect(await screen.findByText("Идёт сейчас")).toBeVisible();
      await backend.setTime("2026-11-11T07:30:00Z");
      await owner.click(screen.getByRole("button", { name: "Обновить" }));
      expect(await screen.findByText("Пока нет текущих и предстоящих встреч")).toBeVisible();
      expect(screen.queryByText("Анна")).not.toBeInTheDocument();
    },
    { beforeRender: (backend) => backend.setTime("2026-11-11T07:00:00Z") },
  );
});

test("initial loading and failure offer retry; background failure keeps the real list with a stale warning", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const network = setupServer(
    http.get(
      "*/api/bookings",
      async () => {
        await gate;
        return HttpResponse.json(
          { code: "storage_unavailable", message: "Unavailable" },
          { status: 503 },
        );
      },
      { once: true },
    ),
  );
  try {
    network.listen({ onUnhandledRequest: "bypass" });
    await withOwner(async (owner) => {
      expect(screen.getByRole("status")).toHaveTextContent("Загружаем встречи");
      expect(screen.queryByText("Пока нет текущих и предстоящих встреч")).not.toBeInTheDocument();
      release();
      expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить встречи");
      await owner.click(screen.getByRole("button", { name: "Повторить" }));
      expect(await screen.findByText("Анна")).toBeVisible();
      network.use(http.get("*/api/bookings", () => HttpResponse.error()));
      await owner.click(screen.getByRole("button", { name: "Обновить" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Список мог устареть");
      expect(screen.getByText("Анна")).toBeVisible();
      expect(screen.getByText("anna@example.com")).toBeVisible();
      network.resetHandlers();
      await owner.click(screen.getByRole("button", { name: "Повторить" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Обновить" })).toBeEnabled());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("Анна")).toBeVisible();
    });
  } finally {
    release();
    network.close();
  }
});

test.each(["meetings tab", "browser focus", "page visibility"])(
  "a booking created by a guest appears immediately on returning to %s",
  async (returnThrough) => {
    await withOwner(
      async (owner, backend) => {
        expect(await screen.findByText("Пока нет текущих и предстоящих встреч")).toBeVisible();
        if (returnThrough === "meetings tab") {
          await owner.click(screen.getByRole("tab", { name: "Типы встреч" }));
        }
        await seed(backend, "2026-11-13T11:00:00Z");
        const records = await fetch(`${backend.url}/api/bookings`).then((response) =>
          response.json(),
        );
        expect(records.items).toEqual([
          expect.objectContaining({ startsAt: "2026-11-13T11:00:00Z" }),
        ]);
        if (returnThrough === "meetings tab") {
          await owner.click(screen.getByRole("tab", { name: "Встречи" }));
        } else if (returnThrough === "browser focus") {
          act(() => window.dispatchEvent(new Event("focus")));
        } else {
          act(() => document.dispatchEvent(new Event("visibilitychange")));
        }
        expect(await screen.findByText("Анна")).toBeVisible();
        expect(screen.getByText("13 ноября 2026 г. · 14:00–14:30")).toBeVisible();
      },
      { seeded: false, beforeRender: (backend) => backend.setTime("2026-11-12T10:00:00Z") },
    );
  },
);

test("минутное обновление работает только на активной видимой вкладке встреч", async () => {
  const refreshReceived = Promise.withResolvers();
  const releaseRefresh = Promise.withResolvers();
  let reads = 0;
  const network = setupServer(
    http.get("*/api/bookings", async ({ request }) => {
      reads += 1;
      const response = await fetch(bypass(request));
      if (reads === 2) {
        refreshReceived.resolve();
        await releaseRefresh.promise;
      }
      return response;
    }),
  );
  const visibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
  try {
    network.listen({ onUnhandledRequest: "bypass" });
    await withOwner(async (owner, backend) => {
      expect(await screen.findByText("Предстоящая")).toBeVisible();
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      await owner.click(screen.getByRole("tab", { name: "Типы встреч" }));
      await owner.click(screen.getByRole("tab", { name: "Встречи" }));
      await refreshReceived.promise;
      expect(screen.getByRole("button", { name: "Обновить" })).toBeDisabled();
      // Сначала завершаем обновление при возврате на вкладку: иначе Query
      // объединит минутный запрос с ещё выполняющимся старым запросом.
      releaseRefresh.resolve();
      await waitFor(() => expect(screen.getByRole("button", { name: "Обновить" })).toBeEnabled());
      expect(reads).toBe(2);
      await backend.setTime("2026-11-11T07:00:00Z");
      await act(() => vi.advanceTimersByTimeAsync(60000));
      expect(await screen.findByText("Идёт сейчас")).toBeVisible();
      expect(reads).toBe(3);
      await owner.click(screen.getByRole("tab", { name: "Типы встреч" }));
      await backend.setTime("2026-11-11T07:30:00Z");
      const inactiveReads = reads;
      await act(() => vi.advanceTimersByTimeAsync(120000));
      expect(reads).toBe(inactiveReads);
      expect(screen.getByText("Анна")).toBeInTheDocument();
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await owner.click(screen.getByRole("tab", { name: "Встречи" }));
      await act(() => vi.advanceTimersByTimeAsync(120000));
      expect(reads).toBe(inactiveReads);
      expect(screen.getByText("Анна")).toBeVisible();
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await act(() => vi.advanceTimersByTimeAsync(60000));
      expect(await screen.findByText("Пока нет текущих и предстоящих встреч")).toBeVisible();
    });
  } finally {
    releaseRefresh.resolve();
    network.close();
    if (visibility) Object.defineProperty(document, "visibilityState", visibility);
    else delete document.visibilityState;
  }
});
