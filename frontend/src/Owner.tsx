import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@mantine/core";
import { useDocumentVisibility } from "@mantine/hooks";
import OwnerTypes from "./OwnerTypes";
import ScrollRegion from "./ScrollRegion";
import { bookingsQuery } from "./queries";

export default function Owner() {
  const [tab, setTab] = useState("meetings");
  const visibility = useDocumentVisibility();
  const query = useQuery({
    ...bookingsQuery,
    enabled: tab === "meetings" && visibility === "visible",
  });
  const list = query.data;
  const error = query.isError;
  const pending = query.isFetching;

  function manualRefresh() {
    if (!pending) void query.refetch({ cancelRefetch: false });
  }

  function navigateTabs(event: React.KeyboardEvent<HTMLButtonElement>) {
    let next: string;
    if (event.key === "Home") next = "meetings";
    else if (event.key === "End") next = "types";
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight")
      next = tab === "meetings" ? "types" : "meetings";
    else return;
    event.preventDefault();
    setTab(next);
    document.getElementById(`${next}-tab`)?.focus();
  }

  return (
    <div className="landing">
      <Container size="xl" className="page-container">
        <header className="site-header">
          <a className="wordmark" href="/" aria-label="Окошко — на главную">
            окошко.
          </a>
          <nav className="header-nav" aria-label="Основная навигация">
            <a href="/book">Записаться</a>
            <a href="/owner" aria-current="page">
              Управление
            </a>
          </nav>
        </header>
        <main className="owner-page">
          <h1>Управление</h1>
          <div role="tablist" aria-label="Управление">
            <button
              role="tab"
              id="meetings-tab"
              aria-controls="meetings-panel"
              aria-selected={tab === "meetings"}
              tabIndex={tab === "meetings" ? 0 : -1}
              onKeyDown={navigateTabs}
              onClick={() => setTab("meetings")}
            >
              Встречи
            </button>
            <button
              role="tab"
              id="types-tab"
              aria-controls="types-panel"
              aria-selected={tab === "types"}
              tabIndex={tab === "types" ? 0 : -1}
              onKeyDown={navigateTabs}
              onClick={() => setTab("types")}
            >
              Типы встреч
            </button>
          </div>
          <section
            role="tabpanel"
            id="meetings-panel"
            aria-labelledby="meetings-tab"
            hidden={tab !== "meetings"}
          >
            <h2>Встречи</h2>
            <p>
              Время владельца: <span>Europe/Moscow</span>
            </p>
            <button className="page-link" disabled={pending} onClick={manualRefresh}>
              Обновить
            </button>
            {pending && !list ? <output>Загружаем встречи…</output> : null}
            {error ? (
              <p role="alert">
                {list
                  ? "Список мог устареть. Не удалось обновить встречи"
                  : "Не удалось загрузить встречи"}{" "}
                <button disabled={pending} onClick={manualRefresh}>
                  Повторить
                </button>
              </p>
            ) : null}
            {list ? (
              <ScrollRegion label="Прокрутка встреч" maxHeight="min(60svh, 36rem)">
                <ul className="owner-bookings" aria-label="Текущие и предстоящие встречи">
                  {list.items.map((booking) => (
                    <li
                      key={booking.id}
                      className={booking.status === "ongoing" ? "ongoing-booking" : undefined}
                    >
                      <div className="booking-summary">
                        <h3>{booking.meetingTypeTitle}</h3>
                        <p>
                          {new Intl.DateTimeFormat("ru-RU", {
                            timeZone: "Europe/Moscow",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }).format(new Date(booking.startsAt))}{" "}
                          ·{" "}
                          {new Intl.DateTimeFormat("ru-RU", {
                            timeZone: "Europe/Moscow",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(booking.startsAt))}
                          –
                          {new Intl.DateTimeFormat("ru-RU", {
                            timeZone: "Europe/Moscow",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(booking.endsAt))}
                        </p>
                      </div>
                      <div className="booking-contact">
                        <p>{booking.name}</p>
                        <p>{booking.email}</p>
                      </div>
                      <strong>
                        {booking.status === "ongoing" ? "Идёт сейчас" : "Предстоящая"}
                      </strong>
                    </li>
                  ))}
                </ul>
              </ScrollRegion>
            ) : null}
            {list?.items.length === 0 ? <p>Пока нет текущих и предстоящих встреч</p> : null}
          </section>
          <section
            role="tabpanel"
            id="types-panel"
            aria-labelledby="types-tab"
            hidden={tab !== "types"}
          >
            {tab === "types" ? <OwnerTypes /> : null}
          </section>
        </main>
      </Container>
    </div>
  );
}
