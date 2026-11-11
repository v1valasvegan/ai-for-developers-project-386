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
  @minLength(1) @maxLength(120)
  @example("Знакомство")
  title: string;
  /** Описание простым текстом, не HTML. */
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
model ApiError {
  /** Машиночитаемая причина ошибки. */
  @example("storage_unavailable")
  code: string;
  /** Сообщение для человека. */
  @example("Хранилище временно недоступно. Повторите попытку")
  message: string;
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
