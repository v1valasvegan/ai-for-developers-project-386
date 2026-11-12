import { useEffect, useState, type ReactNode } from "react";
import { Alert } from "@mantine/core";
import Catalogue from "./Catalogue";
import MeetingTypeCard from "./MeetingTypeCard";
import Toast from "./Toast";
import "./BookingFeedback.css";
import ScrollRegion from "./ScrollRegion";
import { useQueryClient } from "@tanstack/react-query";
import useAvailability from "./useAvailability";
import { queryKeys } from "./queries";
import type { Booking } from "./api/generated/types.gen";
import GuestDetails, { type Attempt, type Guest } from "./GuestDetails";

import BookingCalendar, { type CalendarView } from "./BookingCalendar";
import { localDate, dateLabel, timeLabel } from "./bookingTime";

function parseStart(value: string | null) {
  if (value === null) return null;
  // RFC 3339 requires an explicit offset, not the browser's implicit local timezone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value))
    return NaN;
  // Slots start on whole minutes. Reject nonzero fractions before Date.parse
  // can truncate submillisecond precision into a different, available instant.
  const fraction = value.match(/\.(\d+)/)?.[1];
  if (fraction && /[1-9]/.test(fraction)) return NaN;
  const calendarDate = value.slice(0, 10);
  const midnight = new Date(`${calendarDate}T00:00:00Z`);
  if (
    !Number.isFinite(midnight.getTime()) ||
    midnight.toISOString().slice(0, 10) !== calendarDate ||
    Number(value.slice(11, 13)) > 23
  )
    return NaN;
  return Date.parse(value);
}

function TimeStep({
  id,
  startsAt,
  timeZone,
  navigate,
  guest,
  setGuest,
  onSuccess,
  attempt: submission,
  setAttempt: setSubmission,
  onUnavailable,
  timeFirst,
  zoneControl,
  notice,
}: {
  id: string;
  timeFirst: boolean;
  zoneControl: ReactNode;
  notice: ReactNode;
  startsAt: string | null;
  timeZone: string;
  navigate: (path: string) => void;
  guest: Guest;
  setGuest: (guest: Guest) => void;
  onSuccess: (booking: Booking) => void;
  attempt: Attempt | null;
  setAttempt: (attempt: Attempt | null) => void;
  onUnavailable: (message: string) => void;
}) {
  const [calendarView, setCalendarView] = useState<CalendarView>({ date: "", month: "" });
  const queryClient = useQueryClient();
  const { state, refresh } = useAvailability(id, parseStart(startsAt), submission !== null);

  const back = (
    <div className="booking-step-nav">
      <button className="page-link secondary-link" type="button" onClick={() => navigate("/book")}>
        Назад
      </button>
    </div>
  );
  if (state.status === "loading")
    return (
      <>
        {back}
        {startsAt === null ? zoneControl : null}
        {notice}
        <output>Загружаем свободное время…</output>
      </>
    );
  if (state.status === "error")
    return (
      <>
        {back}
        {notice}
        <p role="alert">Не удалось загрузить свободное время. Повторите попытку.</p>
        <button type="button" className="page-link" onClick={refresh}>
          Повторить
        </button>
      </>
    );
  if (state.status === "empty" && startsAt === null)
    return (
      <>
        {back}
        <p>Пока нет доступных типов встреч</p>
      </>
    );
  const start = parseStart(startsAt);
  const selected =
    state.status === "ready" && start !== null
      ? state.slots.items.find((slot) => Date.parse(slot.startsAt) === start)
      : undefined;
  if (state.status === "invalid" || state.status === "empty" || (startsAt !== null && !selected))
    return (
      <>
        <p role="alert">
          Ссылка неверна или устарела: тип или время больше недоступны. Вернитесь к выбору.
        </p>
        <button className="page-link" type="button" onClick={() => navigate("/book")}>
          Вернуться к выбору
        </button>
      </>
    );

  const summary = state.type ? (
    <p>
      Выбранный тип: {state.type.title} · {state.type.durationMinutes} минут
    </p>
  ) : null;
  if (selected && !id)
    return (
      <section aria-label="Выбор подходящего типа">
        <div className="booking-step-nav">
          <button
            className="page-link secondary-link"
            type="button"
            onClick={() => navigate("/book?choose=time")}
          >
            Назад
          </button>
        </div>
        <h2>Выберите тип встречи</h2>
        <p>
          Выбранное начало: {dateLabel(localDate(selected.startsAt, timeZone))} ·{" "}
          {timeLabel(selected.startsAt, timeZone)} · {timeZone}
        </p>
        <ScrollRegion label="Прокрутка подходящих типов">
          <ul className="catalogue-list" aria-label="Подходящие типы встреч">
            {state.compatible.map((type) => (
              <MeetingTypeCard
                key={type.id}
                meetingType={type}
                heading="h3"
                onSelect={(selectedId) =>
                  navigate(
                    `/book/${encodeURIComponent(selectedId)}?startsAt=${encodeURIComponent(selected.startsAt)}`,
                  )
                }
              />
            ))}
          </ul>
        </ScrollRegion>
      </section>
    );
  if (selected)
    return (
      <section aria-label="Выбранное время">
        <div className="booking-step-nav">
          <button
            type="button"
            className="page-link secondary-link"
            disabled={submission !== null}
            onClick={() =>
              navigate(
                timeFirst
                  ? `/book?startsAt=${encodeURIComponent(selected.startsAt)}`
                  : `/book/${encodeURIComponent(id)}`,
              )
            }
          >
            Назад
          </button>
        </div>
        <h2>Время выбрано</h2>
        {summary}
        <p>
          {dateLabel(localDate(selected.startsAt, timeZone))} ·{" "}
          {timeLabel(selected.startsAt, timeZone)}–{timeLabel(selected.endsAt, timeZone)} ·{" "}
          {timeZone}
        </p>
        <GuestDetails
          id={id}
          startsAt={selected.startsAt}
          guest={guest}
          setGuest={setGuest}
          onSuccess={onSuccess}
          attempt={submission}
          setAttempt={setSubmission}
          onUnavailable={(message) => {
            onUnavailable(message);
            void queryClient.invalidateQueries({ queryKey: queryKeys.slots, refetchType: "none" });
          }}
        />
      </section>
    );
  return (
    <section aria-label="Выбор времени">
      {back}
      <h1>Выберите день и время</h1>
      {notice}
      <BookingCalendar
        slots={state.slots}
        type={state.type}
        timeZone={timeZone}
        zoneControl={zoneControl}
        view={calendarView}
        onViewChange={setCalendarView}
        onSelect={(instant) =>
          navigate(
            `${id ? `/book/${encodeURIComponent(id)}` : "/book"}?startsAt=${encodeURIComponent(instant)}`,
          )
        }
      />
    </section>
  );
}

export default function BookingFlow({ path }: { path: string }) {
  const [location, setLocation] = useState(() => ({
    path,
    search: typeof window === "undefined" ? "" : window.location.search,
  }));
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [guest, setGuest] = useState<Guest>({ name: "", email: "" });
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [notice, setNotice] = useState("");
  const [timeFirst, setTimeFirst] = useState(
    () =>
      !path.replace(/^\/book\/?/, "") &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("startsAt"),
  );
  useEffect(() => {
    const onPop = () =>
      setLocation({ path: window.location.pathname, search: window.location.search });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  function navigate(url: string) {
    if (url.includes("?startsAt=")) setNotice("");
    if (url === "/book") setTimeFirst(false);
    if (url === "/book?choose=time") {
      setTimeFirst(true);
      url = "/book";
    }
    window.history.pushState(null, "", url);
    setLocation({ path: window.location.pathname, search: window.location.search });
  }
  let id: string;
  try {
    id = decodeURIComponent(location.path.replace(/^\/book\/?/, ""));
  } catch {
    id = "invalid/link";
  }
  const activeId = attempt?.body.meetingTypeId ?? id;
  const activeStart =
    attempt?.body.startsAt ?? new URLSearchParams(location.search).get("startsAt");
  const zones = [
    ...new Set([timeZone, "UTC", "Europe/Moscow", ...Intl.supportedValuesOf("timeZone")]),
  ].sort();
  const choosingTime = !confirmed && (activeId || timeFirst) && activeStart === null;
  const catalogue = !confirmed && !activeId && activeStart === null && !timeFirst;
  const zoneControl = (
    <label className="booking-zone">
      Часовой пояс
      <select
        aria-label="Часовой пояс"
        value={timeZone}
        onChange={(event) => setTimeZone(event.target.value)}
      >
        {zones.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </select>
    </label>
  );
  const noticeBanner =
    notice && !confirmed ? (
      <Alert
        className="booking-notice"
        classNames={{
          title: "booking-notice-title",
          message: "booking-notice-message",
          icon: "booking-notice-icon",
        }}
        color="orange"
        title="Выберите другое время"
        role="alert"
        icon={<span aria-hidden="true">!</span>}
      >
        <p>{notice}</p>
        <p>Имя и email сохранены. Их не нужно вводить заново.</p>
      </Alert>
    ) : null;
  return (
    <div className="booking-flow">
      {notice && !confirmed ? (
        <Toast
          key={`warning:${notice}`}
          tone="warning"
          announce={false}
          title="Выберите другое время"
          message={notice}
        />
      ) : null}
      {confirmed ? (
        <Toast
          key={confirmed.id}
          tone="success"
          title="Запись подтверждена"
          message="Ваше время забронировано. Подробности встречи — на экране подтверждения."
        />
      ) : null}
      {catalogue ? (
        <header>
          <p className="eyebrow">Страница записи</p>
          <h1>Типы встреч</h1>
          <p className="hero-description">Начните с типа встречи или свободного времени.</p>
        </header>
      ) : null}
      {!choosingTime ? (
        <>
          {zoneControl}
          <p>Время показано в поясе {timeZone}</p>
        </>
      ) : null}
      {!choosingTime ? noticeBanner : null}
      {confirmed ? (
        <section aria-label="Подтверждение записи">
          <h2>Запись подтверждена</h2>
          <p>{confirmed.meetingTypeTitle}</p>
          <p>
            {dateLabel(localDate(confirmed.startsAt, timeZone))} ·{" "}
            {timeLabel(confirmed.startsAt, timeZone)}–
            {localDate(confirmed.startsAt, timeZone) !== localDate(confirmed.endsAt, timeZone)
              ? `${dateLabel(localDate(confirmed.endsAt, timeZone))} `
              : ""}
            {timeLabel(confirmed.endsAt, timeZone)} · {timeZone}
          </p>
          <p>
            {confirmed.name} · {confirmed.email}
          </p>
          <button
            type="button"
            className="page-link"
            onClick={() => {
              setConfirmed(null);
              setNotice("");
              setGuest({ name: "", email: "" });
              navigate("/book");
            }}
          >
            Записаться ещё
          </button>
        </section>
      ) : activeId || activeStart !== null || timeFirst ? (
        <TimeStep
          key={`${activeId}:${parseStart(activeStart) ?? ""}`}
          id={activeId}
          timeFirst={timeFirst}
          startsAt={activeStart}
          timeZone={timeZone}
          zoneControl={zoneControl}
          notice={choosingTime ? noticeBanner : null}
          navigate={navigate}
          guest={guest}
          setGuest={setGuest}
          onSuccess={setConfirmed}
          attempt={attempt}
          setAttempt={setAttempt}
          onUnavailable={(message) => {
            setNotice(message);
            navigate(`/book/${encodeURIComponent(activeId)}`);
          }}
        />
      ) : (
        <>
          <div className="booking-order-actions">
            <button
              className="page-link"
              type="button"
              onClick={() => document.getElementById("type-first-catalogue")?.scrollIntoView?.()}
            >
              Выбрать тип встречи
            </button>
            <button
              className="page-link"
              type="button"
              onClick={() => navigate("/book?choose=time")}
            >
              Выбрать дату и время
            </button>
          </div>
          <div id="type-first-catalogue">
            <Catalogue onSelect={(typeId) => navigate(`/book/${encodeURIComponent(typeId)}`)} />
          </div>
        </>
      )}
    </div>
  );
}
