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
