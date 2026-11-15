import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { expect, test } from "vitest";
import App from "./App";

function renderLanding(path = "/") {
  return renderToStaticMarkup(createElement(MantineProvider, {}, createElement(App, { path })));
}

test("landing explains the available guest journey and public demo limitations", () => {
  const html = renderLanding();
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  expect(text).toContain("для вашего звонка");
  expect(text).not.toMatch(
    /Один владелец календаря|Владелец календаря задан заранее|Один календарь/,
  );
  expect(text).toContain("Выберите тип встречи");
  expect(text).toContain("Выберите день и время");
  expect(text).toContain("Укажите имя и email");
  expect(text).toContain("подтвердите запись");
  expect(text).toContain("Без регистрации");
  expect(text).toContain("14 календарных дней");
  expect(text).toContain("Учебное демо");
  expect(text).toContain("Страница владельца публична");
  expect(text).toContain("вымышленные имя и email");
  expect(text).not.toMatch(
    /скоро откроемся|в разработке|записаться пока нельзя|запись пока недоступна|запись будет доступна|будущей страницы/iu,
  );
  expect(html).toContain('src="/window-crown.svg"');
  expect(text).not.toMatch(/Поделитесь своим окошком|Анна Смирнова|Психолог|Google Meet|Zoom/);
});

test.each(["/book", "/book/"])(
  "booking catalogue at %s shows first loading, not false empty or a booking promise",
  (path) => {
    const html = renderLanding(path);
    expect(html).toContain("Типы встреч");
    expect(html).toContain("Загружаем типы встреч");
    expect(html).toContain("Начните с типа встречи или свободного времени");
    expect(html).toContain("Выбрать тип встречи");
    expect(html).toContain("Выбрать дату и время");
    expect(html).not.toContain("Пока нет доступных типов встреч");
    expect(html).toMatch(/<a\b[^>]*href="\/"[^>]*>Вернуться на главную<\/a>/);
    expect(html).not.toMatch(/<(form|input|table)\b/);
  },
);

test.each(["/book", "/book/", "/book/intro-30"])(
  "guest screen at %s identifies the demo without announcing a future launch",
  (path) => {
    const html = renderLanding(path);
    expect(html).toContain("Учебное демо");
    expect(html).toContain("вымышленные имя и email");
    expect(html).not.toMatch(/скоро откроемся|в разработке/iu);
  },
);

test("schedule example contains a complete month and available times", () => {
  const html = renderLanding();
  const calendar = html.match(/<table\b[\s\S]*?<\/table>/)?.[0];
  expect(calendar).toBeDefined();
  expect(calendar.match(/<th\s/g)).toHaveLength(7);
  expect(calendar.match(/<td\b/g)).toHaveLength(35);
  const dates = [...calendar.matchAll(/class="calendar-date[^"]*">(\d+)<\/span>/g)].map((match) =>
    Number(match[1]),
  );
  expect(dates).toEqual(Array.from({ length: 31 }, (_, index) => index + 1));
  expect(calendar).toContain('class="calendar-date selected-date">13</span>');
  for (const time of ["10:00", "11:00", "12:30", "14:00", "16:00"]) {
    expect(html).toContain(time);
  }
  expect(html).toContain("Пример интерфейса");
  expect(html).toContain("Актуальные даты и свободное время — на странице записи.");
});

test("illustration marks availability only inside its stated 14-day window", () => {
  const html = renderLanding();
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  expect(text).toContain("Пример окна записи: 13–26 октября 2026 · 14 дней");
  const availableDates = [
    ...html.matchAll(/aria-label="(\d+) октября: (?:выбрано|свободно) в примере"/g),
  ].map((match) => Number(match[1]));
  expect(availableDates).toEqual([13, 14, 15, 16, 19, 20, 21, 22, 23, 26]);
  expect(html).toContain('aria-label="12 октября: недоступно в примере"');
  expect(html).toContain('aria-label="27 октября: недоступно в примере"');
});

test("landing offers only working section links, not forms or fake booking controls", () => {
  const html = renderLanding();
  for (const target of ["main", "how-it-works"]) {
    expect(html).toContain(`href="#${target}"`);
    expect(html).toContain(`id="${target}"`);
  }
  expect(html).not.toContain('href="#about"');
  expect(html).not.toContain('id="about"');
  expect(html).not.toMatch(/<(form|input|button)\b/);
  expect(html).not.toMatch(/href="(?:\/login|\/register)/);
  expect(html).toMatch(/<a\b[^>]*href="\/book"[^>]*>Перейти к записи<\/a>/);
});
