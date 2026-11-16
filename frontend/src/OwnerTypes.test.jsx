// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { http, HttpResponse, bypass } from "msw";
import { setupServer } from "msw/node";
import App from "./App";
import { client } from "./api/generated/client.gen";
import { startBackend, temporaryDatabase } from "../../tests/support/servers.mjs";

// jsdom does not implement viewport media queries; these screens do not depend on them.
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

async function withOwner(run) {
  const database = await temporaryDatabase();
  let backend;
  try {
    backend = await startBackend(database.path);
    client.setConfig({ baseUrl: backend.url });
    render(
      <MantineProvider env="test" forceColorScheme="light">
        <App path="/owner" />
      </MantineProvider>,
    );
    const owner = userEvent.setup();
    await owner.click(screen.getByRole("tab", { name: "Типы встреч" }));
    await run(owner, backend);
  } finally {
    cleanup();
    await backend?.stop();
    await database.cleanup();
  }
}

async function fillForm(owner) {
  await owner.type(
    screen.getByRole("textbox", { name: "Код типа встречи" }),
    " --Intro------30-- ",
  );
  await owner.type(screen.getByRole("textbox", { name: "Название" }), "Знакомство");
  await owner.type(screen.getByRole("textbox", { name: "Описание" }), "Обсудим ваш вопрос");
  await owner.clear(screen.getByRole("spinbutton", { name: "Длительность, минут" }));
  await owner.type(screen.getByRole("spinbutton", { name: "Длительность, минут" }), "30");
}

test("a duplicate code is explained beside the code based on error code, not server wording", async () => {
  const network = setupServer(
    http.post("*/api/meeting-types", () =>
      HttpResponse.json(
        {
          code: "meeting_type_exists",
          message: "Server wording must not select UI behaviour",
        },
        { status: 409 },
      ),
    ),
  );
  try {
    network.listen({ onUnhandledRequest: "bypass" });
    await withOwner(async (owner) => {
      await fillForm(owner);
      await owner.click(screen.getByRole("button", { name: "Создать тип встречи" }));
      expect(await screen.findByText("Этот код уже используется. Выберите другой")).toBeVisible();
      expect(screen.getByRole("textbox", { name: "Код типа встречи" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(screen.getByRole("textbox", { name: "Код типа встречи" })).toHaveValue(
        " --Intro------30-- ",
      );
      expect(screen.getByRole("textbox", { name: "Название" })).toHaveValue("Знакомство");
      expect(screen.getByRole("textbox", { name: "Описание" })).toHaveValue("Обсудим ваш вопрос");
      expect(screen.getByRole("spinbutton", { name: "Длительность, минут" })).toHaveValue(30);
      await owner.type(screen.getByRole("textbox", { name: "Название", exact: true }), "!");
      expect(screen.getByText("Этот код уже используется. Выберите другой")).toBeVisible();
      await owner.type(screen.getByRole("textbox", { name: "Код типа встречи" }), "x");
      expect(screen.getByRole("textbox", { name: "Код типа встречи" })).not.toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(
        screen.queryByText("Этот код уже используется. Выберите другой"),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  } finally {
    network.close();
  }
});

test("a storage failure keeps the form for a retry that creates the real type", async () => {
  const network = setupServer(
    http.post(
      "*/api/meeting-types",
      () =>
        HttpResponse.json(
          {
            code: "storage_unavailable",
            message: "Хранилище временно недоступно. Повторите попытку",
          },
          { status: 503 },
        ),
      { once: true },
    ),
  );
  try {
    network.listen({ onUnhandledRequest: "bypass" });
    await withOwner(async (owner) => {
      await fillForm(owner);
      await owner.click(screen.getByRole("button", { name: "Создать тип встречи" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Хранилище временно недоступно");
      expect(screen.getByRole("textbox", { name: "Код типа встречи" })).toHaveValue(
        " --Intro------30-- ",
      );
      expect(screen.getByRole("textbox", { name: "Название" })).toHaveValue("Знакомство");
      expect(screen.getByRole("textbox", { name: "Описание" })).toHaveValue("Обсудим ваш вопрос");
      expect(screen.getByRole("spinbutton", { name: "Длительность, минут" })).toHaveValue(30);
      await owner.type(screen.getByRole("textbox", { name: "Название", exact: true }), "!");
      expect(screen.getByRole("alert")).toHaveTextContent("Хранилище временно недоступно");
      await owner.keyboard("{Backspace}");
      await owner.click(screen.getByRole("button", { name: "Создать тип встречи" }));
      expect(await screen.findByRole("heading", { name: "Знакомство" })).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  } finally {
    network.close();
  }
});

test("field errors are associated with their labels and retain all entered values", async () =>
  withOwner(async (owner) => {
    await fillForm(owner);
    await owner.clear(screen.getByRole("textbox", { name: "Название" }));
    await owner.type(screen.getByRole("textbox", { name: "Название" }), "   ");
    await owner.click(screen.getByRole("button", { name: "Создать тип встречи" }));
    expect(await screen.findByText("От 1 до 120 символов")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Название" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("textbox", { name: "Название" })).toHaveAccessibleDescription(
      "От 1 до 120 символов",
    );
    expect(screen.getByRole("textbox", { name: "Название" })).toHaveValue("   ");
    expect(screen.getByRole("textbox", { name: "Код типа встречи" })).toHaveValue(
      " --Intro------30-- ",
    );
    expect(screen.getByRole("textbox", { name: "Описание" })).toHaveValue("Обсудим ваш вопрос");
    expect(screen.getByRole("spinbutton", { name: "Длительность, минут" })).toHaveValue(30);
    expect(screen.queryByText("Тип встречи создан")).not.toBeInTheDocument();
  }));

test.each([
  ["textbox", "Код типа встречи", "a"],
  ["textbox", "Название", " "],
  ["textbox", "Описание", " "],
  ["spinbutton", "Длительность, минут", "1"],
])(
  "editing %s %s dismisses only its old error even while the value remains invalid",
  async (role, label, text) =>
    withOwner(async (owner) => {
      const labels = [
        ["textbox", "Код типа встречи"],
        ["textbox", "Название"],
        ["textbox", "Описание"],
        ["spinbutton", "Длительность, минут"],
      ];
      const fields = labels.map(([fieldRole, fieldLabel]) =>
        screen.getByRole(fieldRole, { name: fieldLabel, exact: true }),
      );
      await owner.clear(fields[3]);
      await owner.type(fields[3], "12");
      await owner.click(screen.getByRole("button", { name: "Создать тип встречи" }));
      await waitFor(() =>
        fields.forEach((field) => expect(field).toHaveAttribute("aria-invalid", "true")),
      );
      const edited = screen.getByRole(role, { name: label, exact: true });
      await owner.type(edited, text);
      expect(edited).not.toHaveAttribute("aria-invalid", "true");
      for (const field of fields.filter((field) => field !== edited))
        expect(field).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert")).toHaveTextContent("Проверьте поля формы");
    }),
);

test("editing the last owner field error removes the summary until the next submit", async () =>
  withOwner(async (owner) => {
    await owner.click(screen.getByRole("button", { name: "Создать тип встречи" }));
    await screen.findByRole("alert");
    for (const [label, text] of [
      ["Код типа встречи", "a"],
      ["Название", " "],
      ["Описание", " "],
    ]) {
      const field = screen.getByRole("textbox", { name: label, exact: true });
      await owner.type(field, text);
      expect(field).not.toHaveAttribute("aria-invalid", "true");
    }
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await owner.click(screen.getByRole("button", { name: "Создать тип встречи" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox", { name: "Код типа встречи" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  }));

test("a delayed server response does not restore errors for an owner field edited during submission", async () => {
  let release;
  let received;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    received = resolve;
  });
  const network = setupServer(
    http.post("*/api/meeting-types", async ({ request }) => {
      const response = await fetch(bypass(request));
      received();
      await gate;
      return response;
    }),
  );
  try {
    network.listen({ onUnhandledRequest: "bypass" });
    await withOwner(async (owner) => {
      await fillForm(owner);
      const code = screen.getByRole("textbox", { name: "Код типа встречи" });
      await owner.clear(code);
      await owner.type(code, "a");
      await owner.clear(screen.getByRole("spinbutton", { name: "Длительность, минут" }));
      await owner.type(screen.getByRole("spinbutton", { name: "Длительность, минут" }), "12");
      await owner.click(screen.getByRole("button", { name: "Создать тип встречи" }));
      await started;
      await owner.type(code, "b{Backspace}");
      expect(code).toHaveValue("a");
      release();
      await screen.findByText("От 15 до 480 минут с шагом 15");
      expect(code).not.toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("spinbutton", { name: "Длительность, минут" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });
  } finally {
    release();
    network.close();
  }
});

test("an owner reads the code hint and preview, creates a type and sees a cleared form and real catalogue", async () =>
  withOwner(async (owner) => {
    expect(await screen.findByText("Пока нет доступных типов встреч")).toBeVisible();
    expect(
      screen.getByText("От 3 до 20 символов: латинские буквы, цифры и дефис. Например, intro-30"),
    ).toBeVisible();
    await fillForm(owner);
    expect(screen.getByText("Будет сохранён код: intro-30")).toBeVisible();
    await owner.click(screen.getByRole("button", { name: "Создать тип встречи" }));
    expect(await screen.findByText("Тип встречи создан")).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Знакомство" })).toBeVisible();
    expect(screen.getByText("Обсудим ваш вопрос")).toBeVisible();
    expect(screen.getByText("30 минут")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Код типа встречи" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Название" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Описание" })).toHaveValue("");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Создать тип встречи" })).toBeEnabled(),
    );
  }));
