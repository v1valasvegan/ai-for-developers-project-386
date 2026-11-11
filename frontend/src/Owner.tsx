import { useEffect, useRef, useState } from "react";
import { Container } from "@mantine/core";
import OwnerTypes from "./OwnerTypes";
import { listBookings } from "./api/generated/sdk.gen";
import type { BookingList } from "./api/generated/types.gen";

export default function Owner() {
  const [tab, setTab] = useState("meetings");
  const [list, setList] = useState<BookingList>();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(true);
  const request = useRef<AbortController | null>(null);

  async function refresh() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    try {
      const { data } = await listBookings({ signal: controller.signal });
      if (controller.signal.aborted) return;
      if (data) {
        setList(data);
        setError(false);
      } else setError(true);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setPending(false);
      if (request.current === controller) request.current = null;
    }
  }

  function manualRefresh() {
    if (request.current) return;
    setPending(true);
    void refresh();
  }

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    listBookings({ signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (data) setList(data);
        else setError(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
        if (request.current === controller) request.current = null;
      });
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, []);

  useEffect(() => {
    if (tab !== "meetings") return;
    let interval: ReturnType<typeof setInterval> | undefined;
    function updatePolling() {
      clearInterval(interval);
      if (document.visibilityState === "visible") {
        interval = setInterval(() => void refresh(), 60000);
      }
    }
    updatePolling();
    document.addEventListener("visibilitychange", updatePolling);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", updatePolling);
    };
  }, [tab]);

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
              <ul className="owner-bookings" aria-label="Текущие и предстоящие встречи">
                {list.items.map((booking) => (
                  <li
                    key={booking.id}
                    className={booking.status === "ongoing" ? "ongoing-booking" : undefined}
                  >
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
                    <p>{booking.name}</p>
                    <p>{booking.email}</p>
                    <strong>{booking.status === "ongoing" ? "Идёт сейчас" : "Предстоящая"}</strong>
                  </li>
                ))}
              </ul>
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
