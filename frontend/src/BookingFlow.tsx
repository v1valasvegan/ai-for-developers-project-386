import { useEffect, useState } from "react";
import Catalogue from "./Catalogue";
import { listMeetingTypes, listMeetingTypeSlots } from "./api/generated/sdk.gen";
import type { Booking, MeetingType, SlotList } from "./api/generated/types.gen";
import GuestDetails, { type Attempt, type Guest } from "./GuestDetails";

function localDate(instant: string | number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  return ["year", "month", "day"]
    .map((part) => parts.find(({ type }) => type === part)?.value)
    .join("-");
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

function timeLabel(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}

function parseStart(value: string | null) {
  if (value === null) return null;
  // RFC 3339 requires an explicit offset, not the browser's implicit local timezone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value))
    return NaN;
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

type AvailabilityState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "invalid" }
  | { status: "empty" }
  | { status: "ready"; type?: MeetingType; slots: SlotList; compatible: MeetingType[] };

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
}: {
  id: string;
  timeFirst: boolean;
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
  const [state, setState] = useState<AvailabilityState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [chosenDate, setChosenDate] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const catalogue = await listMeetingTypes({ signal: controller.signal, throwOnError: true });
        const types = catalogue.data.items;
        if (id && !types.some((type) => type.id === id)) {
          if (!controller.signal.aborted) setState({ status: "invalid" });
          return;
        }
        const requested = id ? types.filter((type) => type.id === id) : types;
        const availability = await Promise.all(
          requested.map(async (type) => ({
            type,
            slots: (
              await listMeetingTypeSlots({
                path: { id: type.id },
                signal: controller.signal,
                throwOnError: true,
              })
            ).data,
          })),
        );
        if (controller.signal.aborted) return;
        if (availability.length === 0) {
          setState({ status: "empty" });
          return;
        }
        const unique = new Map(
          availability.flatMap(({ slots }) => slots.items).map((slot) => [slot.startsAt, slot]),
        );
        setState({
          status: "ready",
          type: id ? requested[0] : undefined,
          slots: {
            ...availability[0]!.slots,
            items: [...unique.values()].sort(
              (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
            ),
          },
          compatible: availability
            .filter(({ slots }) =>
              slots.items.some((slot) => Date.parse(slot.startsAt) === parseStart(startsAt)),
            )
            .map(({ type }) => type),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status:
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "meeting_type_not_found"
              ? "invalid"
              : "error",
        });
      }
    }
    void load();
    return () => controller.abort();
  }, [id, startsAt, attempt]);

  const back = (
    <button className="page-link" type="button" onClick={() => navigate("/book")}>
      Назад
    </button>
  );
  if (state.status === "loading")
    return (
      <>
        <output>Загружаем свободное время…</output>
        {back}
      </>
    );
  if (state.status === "error")
    return (
      <>
        <p role="alert">Не удалось загрузить свободное время. Повторите попытку.</p>
        <button
          type="button"
          className="page-link"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
        >
          Повторить
        </button>
        {back}
      </>
    );
  if (state.status === "empty" && startsAt === null)
    return (
      <>
        <p>Пока нет доступных типов встреч</p>
        {back}
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
        <h2>Выберите тип встречи</h2>
        <p>
          Выбранное начало: {dateLabel(localDate(selected.startsAt, timeZone))} ·{" "}
          {timeLabel(selected.startsAt, timeZone)} · {timeZone}
        </p>
        <ul className="catalogue-list" aria-label="Подходящие типы встреч">
          {state.compatible.map((type) => (
            <li key={type.id}>
              <h3>{type.title}</h3>
              <p className="catalogue-description">{type.description}</p>
              <p>{type.durationMinutes} минут</p>
              <button
                className="page-link"
                type="button"
                onClick={() =>
                  navigate(
                    `/book/${encodeURIComponent(type.id)}?startsAt=${encodeURIComponent(selected.startsAt)}`,
                  )
                }
              >
                Выбрать {type.title}
              </button>
            </li>
          ))}
        </ul>
        <button className="page-link" type="button" onClick={() => navigate("/book?choose=time")}>
          Назад
        </button>
      </section>
    );
  if (selected)
    return (
      <section aria-label="Выбранное время">
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
            setState({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
        />
        <button
          type="button"
          className="page-link"
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
      </section>
    );
  if (state.slots.items.length === 0)
    return (
      <>
        <h2>Выберите день и время</h2>
        {summary}
        <p>На ближайшие 14 дней свободного времени нет</p>
        {back}
      </>
    );

  const grouped = new Map<string, SlotList["items"]>();
  for (const slot of state.slots.items) {
    const date = localDate(slot.startsAt, timeZone);
    const entries = grouped.get(date) ?? [];
    entries.push(slot);
    grouped.set(date, entries);
  }
  const date = grouped.has(chosenDate) ? chosenDate : grouped.keys().next().value!;
  const dates = new Set<string>();
  // Include unavailable local dates throughout the server-defined window.
  for (
    let instant = Date.parse(state.slots.windowStart);
    instant < Date.parse(state.slots.windowEnd);
    instant += 3600000
  )
    dates.add(localDate(instant, timeZone));
  return (
    <section aria-label="Выбор времени">
      <h2>Выберите день и время</h2>
      {summary}
      <p>
        Расписание владельца: Europe/Moscow. Окно — 14 календарных дней начиная с московского
        завтра.
      </p>
      <div className="booking-dates" aria-label="Даты">
        {[...dates].map((day) => (
          <button
            type="button"
            key={day}
            disabled={!grouped.has(day)}
            aria-pressed={day === date}
            onClick={() => setChosenDate(day)}
          >
            {dateLabel(day)}
          </button>
        ))}
      </div>
      <h3>{dateLabel(date)}</h3>
      <p>Выберите время самостоятельно · {timeZone}</p>
      <div className="booking-times" aria-label="Свободные старты">
        {grouped.get(date)?.map((slot) => (
          <button
            type="button"
            key={slot.startsAt}
            onClick={() =>
              navigate(
                `${id ? `/book/${encodeURIComponent(id)}` : "/book"}?startsAt=${encodeURIComponent(slot.startsAt)}`,
              )
            }
          >
            {timeLabel(slot.startsAt, timeZone)}
            {id ? `–${timeLabel(slot.endsAt, timeZone)}` : ""}
          </button>
        ))}
      </div>
      {back}
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
  return (
    <div className="booking-flow">
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
      <p>Время показано в поясе {timeZone}</p>
      {notice && !confirmed ? <p role="alert">{notice}</p> : null}
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
          <button
            className="page-link"
            type="button"
            onClick={() => document.getElementById("type-first-catalogue")?.scrollIntoView?.()}
          >
            Выбрать тип встречи
          </button>
          <button className="page-link" type="button" onClick={() => navigate("/book?choose=time")}>
            Выбрать дату и время
          </button>
          <div id="type-first-catalogue">
            <Catalogue onSelect={(typeId) => navigate(`/book/${encodeURIComponent(typeId)}`)} />
          </div>
        </>
      )}
    </div>
  );
}
