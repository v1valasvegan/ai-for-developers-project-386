import { useEffect, useState } from "react";
import Catalogue from "./Catalogue";
import { listMeetingTypes, listMeetingTypeSlots } from "./api/generated/sdk.gen";
import type { MeetingType, SlotList } from "./api/generated/types.gen";

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
  | { status: "ready"; type: MeetingType; slots: SlotList };

function TimeStep({
  id,
  startsAt,
  timeZone,
  navigate,
}: {
  id: string;
  startsAt: string | null;
  timeZone: string;
  navigate: (path: string) => void;
}) {
  const [state, setState] = useState<AvailabilityState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [chosenDate, setChosenDate] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [catalogue, availability] = await Promise.all([
          listMeetingTypes({ signal: controller.signal, throwOnError: true }),
          listMeetingTypeSlots({ path: { id }, signal: controller.signal, throwOnError: true }),
        ]);
        if (controller.signal.aborted) return;
        const type = catalogue.data.items.find((item) => item.id === id);
        setState(
          type ? { status: "ready", type, slots: availability.data } : { status: "invalid" },
        );
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
  }, [id, attempt]);

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
  const start = parseStart(startsAt);
  const selected =
    state.status === "ready" && start !== null
      ? state.slots.items.find((slot) => Date.parse(slot.startsAt) === start)
      : undefined;
  if (state.status === "invalid" || (startsAt !== null && !selected))
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

  const summary = (
    <p>
      Выбранный тип: {state.type.title} · {state.type.durationMinutes} минут
    </p>
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
        <p>Следующий шаг — имя и email. Создание записи ещё в разработке.</p>
        <button
          type="button"
          className="page-link"
          onClick={() => navigate(`/book/${encodeURIComponent(id)}`)}
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
                `/book/${encodeURIComponent(id)}?startsAt=${encodeURIComponent(slot.startsAt)}`,
              )
            }
          >
            {timeLabel(slot.startsAt, timeZone)}–{timeLabel(slot.endsAt, timeZone)}
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
  useEffect(() => {
    const onPop = () =>
      setLocation({ path: window.location.pathname, search: window.location.search });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  function navigate(url: string) {
    window.history.pushState(null, "", url);
    setLocation({ path: window.location.pathname, search: window.location.search });
  }
  let id: string;
  try {
    id = decodeURIComponent(location.path.replace(/^\/book\/?/, ""));
  } catch {
    id = "invalid/link";
  }
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
      {id ? (
        <TimeStep
          key={id}
          id={id}
          startsAt={new URLSearchParams(location.search).get("startsAt")}
          timeZone={timeZone}
          navigate={navigate}
        />
      ) : (
        <Catalogue onSelect={(typeId) => navigate(`/book/${encodeURIComponent(typeId)}`)} />
      )}
    </div>
  );
}
