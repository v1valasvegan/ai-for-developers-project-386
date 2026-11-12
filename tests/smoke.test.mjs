import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { createClient } from "../frontend/src/api/generated/client/index";
import { getHealth } from "../frontend/src/api/generated/sdk.gen";
import { startBackend, startFrontend, temporaryDatabase } from "./support/servers.mjs";

test("built frontend and generated API server start; SDK response matches the contract", async () => {
  const database = await temporaryDatabase();
  let backend;
  let frontend;
  try {
    backend = await startBackend(database.path);
    frontend = await startFrontend(backend.url);
    const page = await fetch(frontend.url);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("<title>Окошко — запись на звонок без регистрации</title>");
    expect(html).toContain("одним заранее заданным владельцем календаря");
    expect(html).not.toContain("для независимых специалистов");

    for (const path of ["/book", "/book/"]) {
      const bookingPage = await fetch(`${frontend.url}${path}`);
      expect(bookingPage.status).toBe(200);
      expect(bookingPage.headers.get("content-type")).toContain("text/html");
      expect(await bookingPage.text()).toContain('id="root"');
    }

    const ornament = await fetch(`${frontend.url}/window-crown.svg`);
    expect(ornament.status).toBe(200);
    expect(ornament.headers.get("content-type")).toContain("image/svg+xml");

    const result = await getHealth({
      client: createClient({ baseUrl: frontend.url }),
      throwOnError: true,
    });
    const contract = parse(await readFile("api/generated/openapi.yaml", "utf8"));
    expect(result.response.status).toBe(200);
    expect(result.data).toEqual({ status: "ok" });
    expect(contract.components.schemas.Health.properties.status.enum).toContain(result.data.status);
    expect(contract.paths["/api/health"].get.operationId).toBe("getHealth");
  } finally {
    await frontend?.stop();
    await backend?.stop();
    await database.cleanup();
  }
}, 30000);
