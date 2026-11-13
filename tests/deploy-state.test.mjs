import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { test } from "vitest";
import { startBackend, temporaryDatabase } from "./support/servers.mjs";

const execute = promisify(execFile);

test("the deploy verification command preserves its meaning after the booking window moves", async () => {
  const database = await temporaryDatabase();
  let server;
  try {
    server = await startBackend(database.path, {
      time: "2026-11-16T12:00:00Z",
      env: { STATIC_DIR: resolve("frontend/dist") },
    });
    const smoke = async (mode) => {
      try {
        await execute(
          process.execPath,
          ["node_modules/@playwright/test/cli.js", "test", "--config=playwright.deploy.config.mjs"],
          {
            env: {
              ...process.env,
              BASE_URL: server.url,
              SMOKE_STATE_FILE: `${database.path}.smoke.json`,
              SMOKE_MODE: mode,
            },
            timeout: 60000,
            maxBuffer: 2000000,
          },
        );
      } catch (error) {
        throw new Error(`Smoke ${mode}:\n${error.stdout}\n${error.stderr}`, { cause: error });
      }
    };
    await smoke("create");
    // Завтра стало сегодня: встреча ещё предстоящая, но новый POST уже вне окна.
    await server.setTime("2026-11-16T21:01:00Z");
    await smoke("verify");
    // Идущая встреча остаётся в списке владельца.
    await server.setTime("2026-11-17T07:15:00Z");
    await smoke("verify");
    // После окончания записи replay по ключу по-прежнему доказывает сохранность.
    await server.setTime("2026-11-17T12:00:00Z");
    await smoke("verify");
  } finally {
    await server?.stop();
    await database.cleanup();
  }
}, 60000);
