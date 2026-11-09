import "@typespec/http";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/** API учебного сервиса записи на звонки «Окошко». */
@service(#{ title: "Окошко API" })
@info(#{ version: "0.1.0" })
@server("http://localhost:3000", "Локальный сервер разработки")
@tagMetadata("Default", #{ description: "Проверка работоспособности сервиса" })
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
