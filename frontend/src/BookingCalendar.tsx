import { useMemo, type ReactNode } from "react";
import type { MeetingType, SlotList } from "./api/generated/types.gen";
import { dateLabel, localDate, timeLabel } from "./bookingTime";
import ScrollRegion from "./ScrollRegion";
import "./BookingCalendar.css";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export type CalendarView = { date: string; month: string };

export default function BookingCalendar({
  slots,
  type,
  timeZone,
  zoneControl,
  onSelect,
  view,
  onViewChange,
}: {
  slots: SlotList;
  type?: MeetingType;
  timeZone: string;
  zoneControl: ReactNode;
  onSelect: (startsAt: string) => void;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
}) {
  const days = new Set<string>();
  for (let t = Date.parse(slots.windowStart); t < Date.parse(slots.windowEnd); t += 3600000)
    days.add(localDate(t, timeZone));
  const dates = [...days];
  const months = [...new Set(dates.map((day) => day.slice(0, 7)))];
  const grouped = new Map<string, SlotList["items"]>();
  for (const slot of slots.items) {
    const day = localDate(slot.startsAt, timeZone);
    const entries = grouped.get(day) ?? [];
    entries.push(slot);
    grouped.set(day, entries);
  }
  // Convert each interval once, not for every calendar cell on every date click.
  const occupiedRanges = useMemo(
    () =>
      (slots.occupied ?? []).map((interval) => ({
        interval,
        firstDay: localDate(interval.startsAt, timeZone),
        lastDay: localDate(Date.parse(interval.endsAt) - 1, timeZone),
      })),
    [slots.occupied, timeZone],
  );
  const occupiedOn = (day: string) =>
    occupiedRanges
      .filter(({ firstDay, lastDay }) => firstDay <= day && lastDay >= day)
      .map(({ interval }) => interval);
  const day = days.has(view.date)
    ? view.date
    : (dates.find((date) => grouped.has(date)) ??
      dates.find((date) => occupiedOn(date).length) ??
      dates[0]!);
  const month = months.includes(view.month) ? view.month : day.slice(0, 7);
  const monthIndex = months.indexOf(month);
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => {
    const n = i - offset + 1;
    return n >= 1 && n <= count ? `${month}-${String(n).padStart(2, "0")}` : null;
  });
  const busy = occupiedOn(day);
  const entries = [
    ...(grouped.get(day) ?? []).map((slot) => ({ ...slot, busy: false })),
    ...busy.map((slot) => ({ ...slot, busy: true })),
  ].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  function intervalLabel(interval: { startsAt: string; endsAt: string }) {
    const startDay = localDate(interval.startsAt, timeZone);
    const endDay = localDate(interval.endsAt, timeZone);
    return startDay === endDay
      ? `${timeLabel(interval.startsAt, timeZone)}–${timeLabel(interval.endsAt, timeZone)}`
      : `${dateLabel(startDay)} ${timeLabel(interval.startsAt, timeZone)}–${dateLabel(endDay)} ${timeLabel(interval.endsAt, timeZone)}`;
  }
  return (
    <div className="booking-calendar-card">
      <aside className="meeting-about">
        <svg className="meeting-window" viewBox="0 0 32 38" fill="none" aria-hidden="true">
          <path d="M3 11 16 2l13 9M6 10v24h20V10M3 35h26M10 13h12v16H10zM16 13v16M10 21h12" />
        </svg>
        <p className="meeting-overline">Одно окошко для вашего вопроса</p>
        <h3>{type?.title ?? "Сначала удобное время"}</h3>
        <ScrollRegion label="Описание встречи" maxHeight="10rem">
          <p className="meeting-description">
            {type?.description ?? "Выберите день и время. Затем покажем подходящие типы встреч."}
          </p>
        </ScrollRegion>
        <p className="meeting-duration">
          ◷ {type ? `${type.durationMinutes} минут` : "Длительность зависит от типа"}
        </p>
        {zoneControl}
        <p className="meeting-schedule-note">
          Расписание владельца
          <br />
          Будни · 10:00–18:00 · Москва
        </p>
      </aside>
      <div className="meeting-month-panel">
        <div className="meeting-month-heading">
          <h3>
            {new Intl.DateTimeFormat("ru-RU", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(first)}
          </h3>
          <div>
            <button
              type="button"
              aria-label="Предыдущий месяц"
              disabled={monthIndex <= 0}
              onClick={() => onViewChange({ date: day, month: months[monthIndex - 1]! })}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Следующий месяц"
              disabled={monthIndex >= months.length - 1}
              onClick={() => onViewChange({ date: day, month: months[monthIndex + 1]! })}
            >
              ›
            </button>
          </div>
        </div>
        <table className="meeting-month" aria-label="Календарь записи">
          <thead>
            <tr>
              {weekdays.map((w) => (
                <th key={w} scope="col">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <tr key={row}>
                {cells.slice(row * 7, row * 7 + 7).map((date, col) => (
                  <td key={date ?? `empty-${col}`}>
                    {date ? (
                      <button
                        type="button"
                        aria-label={dateLabel(date)}
                        aria-pressed={date === day}
                        disabled={
                          !days.has(date) || (!grouped.has(date) && !occupiedOn(date).length)
                        }
                        className={
                          !grouped.has(date) && occupiedOn(date).length
                            ? "meeting-busy-day"
                            : undefined
                        }
                        onClick={() => onViewChange({ date, month: date.slice(0, 7) })}
                      >
                        {Number(date.slice(-2))}
                      </button>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="meeting-calendar-note">Окно записи — 14 дней · время в выбранном поясе</p>
        <div className="meeting-legend">
          <span>
            <i className="meeting-free-dot" />
            Есть свободное время
          </span>
          <span>
            <i className="meeting-busy-dot" />
            Занято
          </span>
        </div>
      </div>
      <section className="meeting-times-panel" aria-label="Время выбранного дня">
        <h3>
          {new Intl.DateTimeFormat("ru-RU", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          }).format(new Date(`${day}T12:00:00Z`))}
        </h3>
        <p className="meeting-timezone-note">{timeZone}</p>
        {busy.length ? (
          <ScrollRegion label="Занятые интервалы" maxHeight="7.5rem">
            <ul className="meeting-occupied">
              {busy.map((interval) => (
                <li key={`${interval.startsAt}:${interval.endsAt}`}>
                  <span>{intervalLabel(interval)}</span>
                  <strong>Занято</strong>
                </li>
              ))}
            </ul>
          </ScrollRegion>
        ) : null}
        {!slots.items.length ? (
          <p className="meeting-empty">На ближайшие 14 дней свободного времени нет</p>
        ) : !grouped.has(day) ? (
          <p className="meeting-empty">В этот день свободного времени нет</p>
        ) : null}
        <p className="meeting-choose-note">Выберите время начала</p>
        <ScrollRegion label="Свободное и занятое время" maxHeight="min(48svh, 22rem)">
          <div className="booking-times meeting-time-options">
            {entries.map((entry) => (
              <button
                type="button"
                key={`${entry.busy}:${entry.startsAt}`}
                disabled={entry.busy}
                aria-label={
                  entry.busy
                    ? `${intervalLabel(entry)} · Занято`
                    : type
                      ? `${timeLabel(entry.startsAt, timeZone)}–${timeLabel(entry.endsAt, timeZone)}`
                      : timeLabel(entry.startsAt, timeZone)
                }
                className={entry.busy ? "meeting-occupied-option" : undefined}
                onClick={() => onSelect(entry.startsAt)}
              >
                <span>{timeLabel(entry.startsAt, timeZone)}</span>
                <span aria-hidden="true">{entry.busy ? "Занято" : "↗"}</span>
              </button>
            ))}
          </div>
        </ScrollRegion>
        <p className="meeting-times-note">
          Занятые интервалы нельзя выбрать.
          <br />
          Больше времени — прокрутите список.
        </p>
      </section>
    </div>
  );
}
