// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { http, HttpResponse, bypass } from "msw";
import { setupServer } from "msw/node";
import BookingFlow from "./BookingFlow";
import { client } from "./api/generated/client.gen";
import { startBackend, temporaryDatabase } from "../../tests/support/servers.mjs";
import { prepareCatalogue } from "../../tests/support/catalogue-fixture.mjs";

const link = "/book/intro-30?startsAt=2026-11-11T07:00:00Z";
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/book");
});
async function setup(run) {
  const database = await temporaryDatabase();
  let backend;
  try {
    await prepareCatalogue(database.path);
    backend = await startBackend(database.path, { time: "2026-11-10T12:00:00Z" });
    client.setConfig({ baseUrl: backend.url });
    window.history.replaceState(null, "", link);
    await run(backend, userEvent.setup());
  } finally {
    await backend?.stop();
    await database.cleanup();
  }
}

test("guest values survive Back and a real submit shows complete confirmation and explicit new booking", async () => {
  await setup(async (_backend, guest) => {
    render(<BookingFlow path="/book/intro-30" />);
    await guest.selectOptions(screen.getByLabelText("Часовой пояс"), "Europe/Moscow");
    await guest.type(await screen.findByLabelText("Имя"), "Анна");
    await guest.type(screen.getByLabelText("Email"), "Anna@Example.com");
    await guest.click(screen.getByRole("button", { name: "Назад" }));
    await guest.click(await screen.findByRole("button", { name: "10:15–10:45" }));
    expect(await screen.findByLabelText("Имя")).toHaveValue("Анна");
    expect(screen.getByLabelText("Email")).toHaveValue("Anna@Example.com");
    await guest.click(screen.getByRole("button", { name: "Подтвердить запись" }));
    expect(await screen.findByRole("heading", { name: "Запись подтверждена" })).toBeVisible();
    expect(screen.getByText("Знакомство")).toBeVisible();
    expect(screen.getByText("11 ноября 2026 г. · 10:15–10:45 · Europe/Moscow")).toBeVisible();
    expect(screen.getByText("Анна · Anna@Example.com")).toBeVisible();
    expect(window.location.href).not.toContain("Anna");
    expect(screen.queryByLabelText("Имя")).not.toBeInTheDocument();
    await guest.click(screen.getByRole("button", { name: "Записаться ещё" }));
    expect(await screen.findByRole("button", { name: "Выбрать Знакомство" })).toBeVisible();
  });
});

test.each(["2026-11-11T07:00:00Z", "2026-11-11T10:00:00+03:00"])(
  "field errors stay under their fields without erasing the other guest value: %s",
  async (startsAt) => {
    await setup(async (_backend, guest) => {
      window.history.replaceState(
        null,
        "",
        `/book/intro-30?startsAt=${encodeURIComponent(startsAt)}`,
      );
      render(<BookingFlow path="/book/intro-30" />);
      await guest.type(await screen.findByLabelText("Имя"), "  ");
      await guest.type(screen.getByLabelText("Email"), "Anna@Example.com");
      await guest.click(screen.getByRole("button", { name: "Подтвердить запись" }));
      expect(await screen.findByText("Укажите имя от 1 до 120 символов")).toBeVisible();
      expect(screen.getByLabelText("Имя")).toHaveAccessibleDescription(
        "Укажите имя от 1 до 120 символов",
      );
      expect(screen.getByLabelText("Email")).toHaveValue("Anna@Example.com");
      await guest.type(screen.getByLabelText("Имя"), "Анна");
      await guest.clear(screen.getByLabelText("Email"));
      await guest.type(screen.getByLabelText("Email"), "bad");
      await guest.click(screen.getByRole("button", { name: "Подтвердить запись" }));
      expect(await screen.findByText("Укажите корректный email до 254 символов")).toBeVisible();
      expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
        "Укажите корректный email до 254 символов",
      );
      expect(screen.getByLabelText("Имя")).toHaveValue("  Анна");
      await guest.clear(screen.getByLabelText("Email"));
      await guest.type(screen.getByLabelText("Email"), "Anna@Example.com");
      await guest.click(screen.getByRole("button", { name: "Подтвердить запись" }));
      expect(await screen.findByRole("heading", { name: "Запись подтверждена" })).toBeVisible();
    });
  },
);

test.each(["2026-11-11T07:00:00Z", "2026-11-11T10:00:00+03:00"])(
  "lost confirmation preserves an immutable in-memory attempt for retry with no duplicate: %s",
  async (startsAt) => {
    await setup(async (backend, guest) => {
      window.history.replaceState(
        null,
        "",
        `/book/intro-30?startsAt=${encodeURIComponent(startsAt)}`,
      );
      const requests = [];
      const network = setupServer(
        http.post(`${backend.url}/api/bookings`, async ({ request }) => {
          requests.push(await request.clone().json());
          const response = await fetch(bypass(request));
          return requests.length === 1 ? HttpResponse.error() : response;
        }),
      );
      network.listen({ onUnhandledRequest: "bypass" });
      try {
        render(<BookingFlow path="/book/intro-30" />);
        await guest.type(await screen.findByLabelText("Имя"), "Анна");
        await guest.type(screen.getByLabelText("Email"), "Anna@Example.com");
        await guest.click(screen.getByRole("button", { name: "Подтвердить запись" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Не удалось получить подтверждение. Запись могла создаться. Повторите отправку",
        );
        expect(screen.getByLabelText("Имя")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Назад" })).toBeDisabled();
        await guest.selectOptions(screen.getByLabelText("Часовой пояс"), "UTC");
        await guest.click(screen.getByRole("button", { name: "Повторить" }));
        expect(await screen.findByRole("heading", { name: "Запись подтверждена" })).toBeVisible();
        expect(requests).toHaveLength(2);
        expect(requests[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
        expect(requests[1]).toEqual(requests[0]);
        expect(
          (await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items,
        ).toHaveLength(1);
      } finally {
        network.close();
      }
    });
  },
);

test.each(["conflict", "midnight"])(
  "%s refreshes slots, clears the start and keeps the type and guest",
  async (reason) => {
    await setup(async (backend, guest) => {
      render(<BookingFlow path="/book/intro-30" />);
      await guest.selectOptions(screen.getByLabelText("Часовой пояс"), "Europe/Moscow");
      await guest.type(await screen.findByLabelText("Имя"), "Анна");
      await guest.type(screen.getByLabelText("Email"), "Anna@Example.com");
      if (reason === "midnight") await backend.setTime("2026-11-10T21:00:00Z");
      else
        await fetch(`${backend.url}/api/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingTypeId: "intro-30",
            startsAt: "2026-11-11T07:00:00Z",
            name: "Другой гость",
            email: "other@example.com",
            idempotencyKey: "00000000-0000-4000-8000-000000000001",
          }),
        });
      await guest.click(screen.getByRole("button", { name: "Подтвердить запись" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        reason === "conflict" ? "Это время уже заняли" : "Время вышло из окна записи",
      );
      expect(await screen.findByRole("heading", { name: "Выберите день и время" })).toBeVisible();
      expect(screen.getByText("Выбранный тип: Знакомство · 30 минут")).toBeVisible();
      expect(window.location.search).toBe("");
      await guest.click(
        await screen.findByRole("button", {
          name: reason === "conflict" ? "10:30–11:00" : "10:00–10:30",
        }),
      );
      expect(await screen.findByLabelText("Имя")).toHaveValue("Анна");
      expect(screen.getByLabelText("Email")).toHaveValue("Anna@Example.com");
      await guest.click(screen.getByRole("button", { name: "Подтвердить запись" }));
      expect(await screen.findByRole("heading", { name: "Запись подтверждена" })).toBeVisible();
    });
  },
);

test("explicit new intention after an uncertain result warns, does not cancel, and uses a new key", async () => {
  await setup(async (backend, guest) => {
    const requests = [];
    const network = setupServer(
      http.post(`${backend.url}/api/bookings`, async ({ request }) => {
        requests.push(await request.clone().json());
        const response = await fetch(bypass(request));
        return requests.length === 1 ? HttpResponse.error() : response;
      }),
    );
    network.listen({ onUnhandledRequest: "bypass" });
    try {
      render(<BookingFlow path="/book/intro-30" />);
      await guest.selectOptions(screen.getByLabelText("Часовой пояс"), "Europe/Moscow");
      await guest.type(await screen.findByLabelText("Имя"), "Анна");
      await guest.type(screen.getByLabelText("Email"), "Anna@Example.com");
      await guest.click(screen.getByRole("button", { name: "Подтвердить запись" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Запись могла создаться");
      expect(
        screen.getByText(
          "Предыдущая запись могла сохраниться и не отменяется. Новая попытка не заменяет её.",
        ),
      ).toBeVisible();
      await guest.click(screen.getByRole("button", { name: "Начать новую попытку" }));
      await guest.click(await screen.findByRole("button", { name: "10:30–11:00" }));
      expect(await screen.findByLabelText("Имя")).toHaveValue("Анна");
      await guest.click(screen.getByRole("button", { name: "Подтвердить запись" }));
      expect(await screen.findByRole("heading", { name: "Запись подтверждена" })).toBeVisible();
      expect(requests[1].idempotencyKey).not.toBe(requests[0].idempotencyKey);
      expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toHaveLength(
        2,
      );
    } finally {
      network.close();
    }
  });
});

test("a fresh page restores selection only, not guest details, confirmation or an automatic submission", async () => {
  await setup(async (backend, guest) => {
    const mounted = render(<BookingFlow path="/book/intro-30" />);
    await guest.type(await screen.findByLabelText("Имя"), "Анна");
    await guest.type(screen.getByLabelText("Email"), "Anna@Example.com");
    mounted.unmount();
    render(<BookingFlow path="/book/intro-30" />);
    expect(await screen.findByLabelText("Имя")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "Запись подтверждена" })).not.toBeInTheDocument();
    expect((await fetch(`${backend.url}/api/bookings`).then((r) => r.json())).items).toEqual([]);
    expect(window.location.pathname + window.location.search).toBe(link);
  });
});

test("confirmation disambiguates the ending date when the guest interval crosses local midnight", async () => {
  await setup(async (_backend, guest) => {
    window.history.replaceState(null, "", "/book/intro-30?startsAt=2026-11-11T14:30:00Z");
    render(<BookingFlow path="/book/intro-30" />);
    await guest.selectOptions(screen.getByLabelText("Часовой пояс"), "Asia/Tokyo");
    await guest.type(await screen.findByLabelText("Имя"), "Анна");
    await guest.type(screen.getByLabelText("Email"), "Anna@Example.com");
    await guest.click(screen.getByRole("button", { name: "Подтвердить запись" }));
    expect(await screen.findByRole("heading", { name: "Запись подтверждена" })).toBeVisible();
    expect(
      screen.getByText("11 ноября 2026 г. · 23:30–12 ноября 2026 г. 00:00 · Asia/Tokyo"),
    ).toBeVisible();
  });
});
