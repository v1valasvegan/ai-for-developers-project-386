import "@typespec/http";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/** API учебного сервиса записи на звонки «Окошко». */
@service(#{ title: "Окошко API" })
@info(#{ version: "0.1.0" })
@server("http://localhost:3000", "Локальный сервер разработки")
@tagMetadata("Default", #{ description: "Работоспособность и каталог типов встреч" })
namespace Okoshko;

/** Состояние API сервиса. */
@example(#{ status: "ok" })
model Health {
  /** Готовность сервера отвечать на запросы. */
  @example("ok")
  status: "ok";
}

/** Проверить работоспособность сервера. */
@tag("Default")
@opExample(#{ returnType: #{ status: "ok" } })
@operationId("getHealth")
@get
@route("/api/health")
op getHealth(): Health;

/** Тип встречи одного владельца календаря. */
model MeetingType {
  /** Уникальный читаемый код типа встречи. */
  @minLength(3) @maxLength(20) @pattern("^[a-z0-9]+(-[a-z0-9]+)*$")
  @example("intro-30")
  id: string;
  /** Название простым текстом. */
  @extension("x-plain-text", true)
  @minLength(1) @maxLength(120)
  @example("Знакомство")
  title: string;
  /** Описание простым текстом, не HTML. */
  @extension("x-plain-text", true)
  @minLength(1) @maxLength(2000)
  @example("Обсудим ваш вопрос")
  description: string;
  /** Длительность в минутах, кратная 15. */
  @minValue(15) @maxValue(480)
  @example(30)
  durationMinutes: int32;
}

/** Каталог, отсортированный по коду типа встречи. */
model MeetingTypeList {
  /** Типы встреч; пустой каталог — нормальный результат. */
  @example(#[#{ id: "intro-30", title: "Знакомство", description: "Обсудим ваш вопрос", durationMinutes: 30 }])
  items: MeetingType[];
}

/** Безопасное описание ошибки без внутренних технических подробностей. */
@example(#{ code: "validation_error", message: "Проверьте поля формы", fieldErrors: #{ id: "Проверьте код типа встречи" } })
model ApiError {
  /** Машиночитаемая причина ошибки. */
  @example("storage_unavailable")
  code: string;
  /** Сообщение для человека. */
  @example("Хранилище временно недоступно. Повторите попытку")
  message: string;
  /** Сообщения только для ошибочных полей запроса. */
  @example(#{ id: "Этот код уже используется. Выберите другой" })
  fieldErrors?: Record<string>;
}

/** Хранилище временно недоступно. */
@error
model StorageUnavailable {
  @statusCode statusCode: 503;
  @body body: ApiError;
}

/** Непредвиденная внутренняя ошибка. */
@error
model InternalError {
  @statusCode statusCode: 500;
  @body body: ApiError;
}

/** Получить доступные типы встреч в порядке кода. */
@tag("Default")
@opExample(#{ returnType: #{ items: #[] } })
@operationId("listMeetingTypes")
@get
@route("/api/meeting-types")
op listMeetingTypes(): MeetingTypeList | StorageUnavailable | InternalError;

/** Поля владельца до нормализации и проверки сервером. */
model CreateMeetingType {
  /** Код: после нормализации 3–20 латинских букв, цифр и дефисов. */
  @example("Intro------30")
  id: string;
  /** Название: после удаления пробелов по краям 1–120 символов. */
  @extension("x-plain-text", true)
  @example("Знакомство")
  title: string;
  /** Описание простым текстом: после удаления пробелов по краям 1–2000 символов. */
  @extension("x-plain-text", true)
  @example("Обсудим ваш вопрос")
  description: string;
  /** Целое число 15–480 включительно, кратное 15. */
  @example(30)
  durationMinutes: int32;
}

/** Ошибки полей или некорректный запрос. */
@error
model ValidationError {
  @statusCode statusCode: 400;
  @body body: ApiError;
}

/** Нормализованный код уже используется. */
@error
model MeetingTypeExists {
  @statusCode statusCode: 409;
  @body body: ApiError;
}

/** Создать тип встречи с уникальным нормализованным кодом. */
@tag("Default")
@operationId("createMeetingType")
@post
@route("/api/meeting-types")
op createMeetingType(
  /** Поля нового типа встречи до серверной нормализации. */
  @body body: CreateMeetingType
): {
  @statusCode statusCode: 201;
  @body body: MeetingType;
} | ValidationError | MeetingTypeExists | StorageUnavailable | InternalError;

/** Свободный интервал выбранного типа встречи. */
model Slot {
  /** Начало включительно, момент UTC. */
  @example(utcDateTime.fromISO("2026-11-11T07:00:00Z"))
  startsAt: utcDateTime;
  /** Окончание исключительно, момент UTC. */
  @example(utcDateTime.fromISO("2026-11-11T07:30:00Z"))
  endsAt: utcDateTime;
}

/** Доступность на всё актуальное окно, даже при пустом items. */
model SlotList {
  /** Серверное время расчёта. */
  @example(utcDateTime.fromISO("2026-11-10T12:00:00Z"))
  serverTime: utcDateTime;
  /** Включённая граница окна: московское завтра 00:00. */
  @example(utcDateTime.fromISO("2026-11-10T21:00:00Z"))
  windowStart: utcDateTime;
  /** Исключённая граница: московская дата D+15 00:00. */
  @example(utcDateTime.fromISO("2026-11-24T21:00:00Z"))
  windowEnd: utcDateTime;
  /** Пояс расписания владельца. */
  @example("Europe/Moscow")
  timeZone: "Europe/Moscow";
  /** Свободные слоты, отсортированные по началу. */
  @example(#[#{ startsAt: utcDateTime.fromISO("2026-11-11T07:00:00Z"), endsAt: utcDateTime.fromISO("2026-11-11T07:30:00Z") }])
  items: Slot[];
}

/** Указанный тип встречи не существует. */
@error
model MeetingTypeNotFound {
  @statusCode statusCode: 404;
  @body body: ApiError;
}

/** Получить свободные слоты типа; просмотр ничего не резервирует. */
@tag("Default")
@opExample(#{ returnType: #{ serverTime: utcDateTime.fromISO("2026-11-10T12:00:00Z"), windowStart: utcDateTime.fromISO("2026-11-10T21:00:00Z"), windowEnd: utcDateTime.fromISO("2026-11-24T21:00:00Z"), timeZone: "Europe/Moscow", items: #[] } })
@operationId("listMeetingTypeSlots")
@get
@route("/api/meeting-types/{id}/slots")
op listMeetingTypeSlots(
  /** Код типа встречи. */
  @path id: string,
): SlotList | MeetingTypeNotFound | StorageUnavailable | InternalError;

/** Данные открытой попытки бронирования. */
@example(#{ meetingTypeId: "intro-30", startsAt: "2026-11-11T07:00:00Z", name: "Анна", email: "anna@example.com", idempotencyKey: "00000000-0000-4000-8000-000000000001" })
model CreateBooking {
  /** Код типа встречи. */
  meetingTypeId: string;
  /** RFC 3339 с обязательным поясом; проверяется сервером. */
  startsAt: string;
  /** Имя простым текстом, после удаления краевых пробелов 1–120 символов. */
  @extension("x-plain-text", true)
  name: string;
  /** Email после удаления краевых пробелов, до 254 символов. */
  @extension("x-plain-text", true)
  email: string;
  /** UUID попытки, не идентификатор записи. */
  idempotencyKey: string;
}

/** Подтверждённая запись гостя. */
@example(#{ id: "d3cd41b7-1672-4363-a7f0-fb5292fdc976", meetingTypeId: "intro-30", meetingTypeTitle: "Знакомство", startsAt: utcDateTime.fromISO("2026-11-11T07:00:00Z"), endsAt: utcDateTime.fromISO("2026-11-11T07:30:00Z"), name: "Анна", email: "anna@example.com" })
model Booking {
  /** Серверный UUID записи. */
  id: string;
  /** Код выбранного типа. */
  meetingTypeId: string;
  /** Название типа на момент создания. */
  @extension("x-plain-text", true)
  meetingTypeTitle: string;
  /** Начало включительно, UTC. */
  startsAt: utcDateTime;
  /** Окончание исключительно, UTC. */
  endsAt: utcDateTime;
  /** Имя гостя простым текстом. */
  @extension("x-plain-text", true)
  name: string;
  /** Контакт гостя. */
  @extension("x-plain-text", true)
  email: string;
}

/** Текущая или предстоящая встреча. */
@example(#{ id: "d3cd41b7-1672-4363-a7f0-fb5292fdc976", meetingTypeId: "intro-30", meetingTypeTitle: "Знакомство", startsAt: utcDateTime.fromISO("2026-11-11T07:00:00Z"), endsAt: utcDateTime.fromISO("2026-11-11T07:30:00Z"), name: "Анна", email: "anna@example.com", status: "upcoming" })
model OwnerBooking extends Booking {
  /** Вычислен относительно serverTime. */
  status: "upcoming" | "ongoing";
}

/** Встречи всех типов по возрастанию начала. */
@example(#{ serverTime: utcDateTime.fromISO("2026-11-10T12:00:00Z"), items: #[] })
model BookingList {
  /** Момент расчёта статусов. */
  serverTime: utcDateTime;
  /** Завершённые встречи исключены. */
  items: OwnerBooking[];
}

/** Пересечение либо другое содержимое успешного ключа. */
@error
model BookingConflict {
  @statusCode statusCode: 409;
  @body body: ApiError;
}

/** Атомарно создать запись или получить результат прежней попытки. */
@tag("Default")
@operationId("createBooking")
@post
@route("/api/bookings")
op createBooking(
  /** Поля гостя, выбранный старт и UUID открытой попытки. */
  @body body: CreateBooking
): {
  @statusCode statusCode: 201;
  @body body: Booking;
} | {
  @statusCode statusCode: 200;
  @body body: Booking;
} | ValidationError | MeetingTypeNotFound | BookingConflict | StorageUnavailable | InternalError;

/** Получить текущие и предстоящие встречи владельца всех типов, отсортированные по началу. */
@tag("Default")
@opExample(#{ returnType: #{ serverTime: utcDateTime.fromISO("2026-11-10T12:00:00Z"), items: #[] } })
@operationId("listBookings")
@get
@route("/api/bookings")
op listBookings(): BookingList | StorageUnavailable | InternalError;
