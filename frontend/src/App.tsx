import { Container } from "@mantine/core";
import "./App.css";
import BookingFlow from "./BookingFlow";
import OwnerTypes from "./OwnerTypes";

const steps = [
  {
    number: "01",
    title: "Выберите тип встречи",
    description:
      "У каждого типа встречи есть название, описание и длительность. Выберите тот, который подходит вашему вопросу.",
  },
  {
    number: "02",
    title: "Выберите день и время",
    description:
      "Запись будет доступна на ближайшие 14 календарных дней. Свободные окошки зависят от длительности выбранной встречи.",
  },
  {
    number: "03",
    title: "Укажите имя и email",
    description:
      "Проверьте выбранное время и подтвердите запись. Создавать аккаунт или входить в личный кабинет не понадобится.",
  },
];

function WindowMark() {
  return (
    <svg viewBox="0 0 32 38" fill="none" aria-hidden="true" className="window-mark">
      <path d="M3 11 16 2l13 9M6 10v24h20V10M3 35h26M10 13h12v16H10zM16 13v16M10 21h12" />
      <path d="m11 8 5-3 5 3M7 37h3m12 0h3" />
    </svg>
  );
}

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const calendarWeeks = Array.from({ length: 5 }, (_, week) =>
  Array.from({ length: 7 }, (_, weekday) => {
    const date = week * 7 + weekday - 2;
    return date >= 1 && date <= 31 ? date : null;
  }),
);

function SchedulePreview() {
  return (
    <figure className="schedule-scene">
      <img className="window-crown" src="/window-crown.svg" alt="" width="1100" height="100" />
      <div className="schedule-frame">
        <div className="preview-toolbar">
          <span className="preview-address">
            <WindowMark /> окошко / пример
          </span>
          <span className="preview-example">Пример страницы записи</span>
        </div>
        <div className="schedule-preview">
          <div className="specialist-panel">
            <div className="preview-profile">
              <span className="profile-monogram" aria-hidden="true">
                о.
              </span>
              <div>
                <p className="profile-name">Владелец календаря</p>
                <p className="profile-profession">Демонстрационный пример</p>
              </div>
            </div>
            <h2>Знакомство</h2>
            <p className="session-description">
              Пример типа встречи: короткий звонок, чтобы обсудить вопрос и договориться о следующих
              шагах.
            </p>
            <ul className="session-details">
              <li>
                <span aria-hidden="true">◷</span> 20 минут
              </li>
              <li>
                <span aria-hidden="true">↗</span> Звонок
              </li>
            </ul>
            <p className="specialist-note">
              Название, описание и длительность — у каждого типа встречи свои.
            </p>
          </div>
          <div className="calendar-panel">
            <div className="calendar-heading">
              <h3>
                Октябрь <span>2026</span>
              </h3>
              <span className="calendar-arrows" aria-hidden="true">
                ‹ <span>›</span>
              </span>
            </div>
            <p className="calendar-window">Пример окна записи: 13–26 октября 2026 · 14 дней</p>
            <table className="month-calendar">
              <caption className="visually-hidden">
                Пример календаря на октябрь 2026 года. Выбрано 13 октября.
              </caption>
              <thead>
                <tr>
                  {weekdays.map((day) => (
                    <th key={day} scope="col">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendarWeeks.map((week) => (
                  <tr key={week.join("-")}>
                    {week.map((date, weekday) => {
                      if (date === null)
                        return <td key={weekdays[weekday]} aria-label="Нет даты" />;
                      const isAvailable = date >= 13 && date <= 26 && weekday < 5;
                      const label =
                        date === 13 ? "выбрано" : isAvailable ? "свободно" : "недоступно";
                      return (
                        <td
                          key={weekdays[weekday]}
                          aria-label={`${date} октября: ${label} в примере`}
                        >
                          <span
                            className={
                              date === 13
                                ? "calendar-date selected-date"
                                : isAvailable
                                  ? "calendar-date available-date"
                                  : "calendar-date muted-date"
                            }
                          >
                            {date}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="preview-timezone">
              <span aria-hidden="true">◎</span> Москва, UTC+3
            </p>
          </div>
          <div className="times-panel">
            <h3>Вторник, 13 октября</h3>
            <p className="times-description">Есть свободные окошки</p>
            <div className="preview-times" aria-label="Примеры свободного времени">
              {["10:00", "11:00", "12:30", "14:00", "16:00"].map((time) => (
                <span key={time} className={time === "12:30" ? "featured-time" : undefined}>
                  {time}
                  <span aria-hidden="true">{time === "12:30" ? "✓" : "↗"}</span>
                </span>
              ))}
            </div>
            <p className="times-note">
              В этом примере выбрано время.
              <br />
              Настоящая запись пока недоступна.
            </p>
          </div>
        </div>
      </div>
      <figcaption>
        <span aria-hidden="true">✳</span> Так может выглядеть страница записи. Это пример,
        записаться пока нельзя.
      </figcaption>
    </figure>
  );
}

function BookingCatalogue({ path }: { path: string }) {
  return (
    <div className="landing">
      <Container size="xl" className="page-container">
        <header className="site-header">
          <a className="wordmark" href="/" aria-label="Окошко — на главную">
            <WindowMark />
            <span>
              окошко<span className="wordmark-dot">.</span>
            </span>
          </a>
          <nav className="header-nav" aria-label="Основная навигация">
            <a href="/owner">Управление</a>
          </nav>
          <span className="development-status">
            <span />
            Скоро откроемся
          </span>
        </header>
        <main className="booking-catalogue" aria-labelledby="booking-title">
          <div className="hero-copy">
            <p className="eyebrow">Страница записи</p>
            <h1 id="booking-title">Типы встреч</h1>
            <p className="hero-description">Начните с типа встречи или свободного времени.</p>
            <BookingFlow path={path} />
            <div className="hero-actions">
              <a className="page-link" href="/">
                Вернуться на главную
              </a>
            </div>
          </div>
        </main>
      </Container>
    </div>
  );
}

export default function App({ path = "/" }: { path?: string }) {
  if (path === "/book" || path.startsWith("/book/")) return <BookingCatalogue path={path} />;
  if (path === "/owner" || path === "/owner/") return <OwnerTypes />;
  return (
    <div className="landing">
      <a className="skip-link" href="#main">
        К содержанию
      </a>
      <Container size="xl" className="page-container">
        <header id="top" className="site-header">
          <a className="wordmark" href="#top" aria-label="Окошко — на главную">
            <WindowMark />
            <span>
              окошко<span className="wordmark-dot">.</span>
            </span>
          </a>
          <nav className="header-nav" aria-label="Основная навигация">
            <a href="#how-it-works">Как это работает</a>
            <a href="/owner">Управление</a>
          </nav>
          <span className="development-status">
            <span />
            Скоро откроемся
          </span>
        </header>

        <main id="main">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <p className="eyebrow">
                <span className="little-sun" aria-hidden="true">
                  ✳
                </span>{" "}
                Меньше переписки. Больше дела.
              </p>
              <h1 id="hero-title">
                Найдётся <span className="accent-word">окошко</span>
                <br />
                для вашего звонка<span className="accent-dot">.</span>
              </h1>
              <p className="hero-description">
                Простой сервис записи на звонок. Выберите тип встречи, найдите свободное время и
                оставьте свои данные. Без регистрации и лишней переписки.
              </p>
              <div className="hero-actions">
                <a className="page-link" href="/book">
                  Перейти к записи
                </a>
                <p>Страница записи пока в разработке.</p>
              </div>
            </div>
            <SchedulePreview />
          </section>

          <section id="how-it-works" className="how-section" aria-labelledby="how-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Всё просто</p>
                <h2 id="how-title">
                  Хорошей встрече —<br />
                  простое начало.
                </h2>
              </div>
              <p className="section-aside">
                Ваше время ценно.
                <br />
                Не тратьте его на согласование времени.
              </p>
            </div>
            <ol className="steps">
              {steps.map((step) => (
                <li key={step.number}>
                  <span className="step-number">
                    {step.number}
                    <span aria-hidden="true"> /</span>
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </section>

          <aside className="launch-note" aria-label="Статус сервиса">
            <span className="launch-symbol" aria-hidden="true">
              ↗
            </span>
            <p>
              <strong>Пока приоткрываем ставни.</strong> Сервис ещё в разработке. Здесь — наша идея
              и пример будущей страницы записи.
            </p>
          </aside>
        </main>

        <footer className="site-footer">
          <a className="wordmark footer-wordmark" href="#top" aria-label="Окошко — наверх">
            <WindowMark />
            <span>окошко.</span>
          </a>
          <p>Для встреч, на которые есть время.</p>
          <span>Сделано с вниманием к людям</span>
        </footer>
      </Container>
    </div>
  );
}
