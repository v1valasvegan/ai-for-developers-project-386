// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import App from "./App";
import { client } from "./api/generated/client.gen";
import { startBackend, temporaryDatabase } from "../../tests/support/servers.mjs";
import { prepareCatalogue } from "../../tests/support/catalogue-fixture.mjs";

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

afterEach(cleanup);

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
