import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { createClient } from "../frontend/src/api/generated/client/index";
import { getHealth } from "../frontend/src/api/generated/sdk.gen";
import { freePort, startBackend, temporaryDatabase } from "./support/servers.mjs";

test.each(["", "not-a-port", "0", "-1", "65536"])(
  "invalid PORT %j prevents startup",
  async (port) => {
    const database = await temporaryDatabase();
    try {
      await expect(startBackend(database.path, { env: { PORT: port } })).rejects.toThrow(
        "Server exited",
      );
    } finally {
      await database.cleanup();
    }
  },
);

test("one server serves the built SPA, deep links, assets and real API without HTML API fallbacks", async () => {
  const database = await temporaryDatabase();
  let server;
  try {
    server = await startBackend(database.path, { env: { STATIC_DIR: resolve("frontend/dist") } });
    const index = await readFile("frontend/dist/index.html", "utf8");
    for (const path of ["/", "/book", "/book/", "/book/intro-30", "/owner", "/owner/"]) {
      const response = await fetch(`${server.url}${path}`);
      expect(response.status, path).toBe(200);
      expect(response.headers.get("content-type"), path).toContain("text/html");
      const html = await response.text();
      expect(html, path).toBe(index);
      expect(html, path).toContain("Учебное демо");
      expect(html, path).not.toMatch(/сервис в разработке|скоро откроемся/iu);
    }
    const asset = index.match(/src="(\/assets\/[^"]+\.js)"/)[1];
    const response = await fetch(`${server.url}${asset}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/javascript/);
    for (const path of [
      "/api",
      "/api/unknown",
      "/api/meeting-types/missing/extra",
      "/assets/missing.js",
    ]) {
      const missing = await fetch(`${server.url}${path}`);
      expect(missing.status, path).toBe(404);
      expect(await missing.text(), path).not.toContain('id="root"');
    }
    const health = await getHealth({
      client: createClient({ baseUrl: server.url }),
      throwOnError: true,
    });
    expect(health.data).toEqual({ status: "ok" });
  } finally {
    await server?.stop();
    await database.cleanup();
  }
});

test("a missing STATIC_DIR index prevents reporting a ready server", async () => {
  const database = await temporaryDatabase();
  try {
    await expect(
      startBackend(database.path, { env: { STATIC_DIR: database.path } }),
    ).rejects.toThrow("Server exited");
  } finally {
    await database.cleanup();
  }
});

test("SIGTERM shuts down the server cleanly rather than terminating the process", async () => {
  const database = await temporaryDatabase();
  let server;
  try {
    server = await startBackend(database.path);
    const [code, signal] = await server.stop("SIGTERM");
    expect(code).toBe(0);
    expect(signal).toBeNull();
  } finally {
    await server?.stop();
    await database.cleanup();
  }
});

test("PORT selects the externally bound server port instead of BIND_ADDR", async () => {
  const database = await temporaryDatabase();
  const port = await freePort();
  let server;
  try {
    server = await startBackend(database.path, { env: { PORT: String(port) } });
    expect(server.url).toBe(`http://127.0.0.1:${port}`);
    expect(server.logs).toContain(`http://0.0.0.0:${port}`);
    const result = await getHealth({
      client: createClient({ baseUrl: server.url }),
      throwOnError: true,
    });
    expect(result.data).toEqual({ status: "ok" });
  } finally {
    await server?.stop();
    await database.cleanup();
  }
});
