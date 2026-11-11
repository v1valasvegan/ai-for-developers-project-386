import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

export async function temporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "okoshko-test-"));
  return {
    path: join(directory, "catalogue.sqlite3"),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    return server.address().port;
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function startServer(command, args, env, readyPattern) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  const stop = async () => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill("SIGINT");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 3000);
    try {
      await exited;
    } finally {
      clearTimeout(timeout);
    }
  };
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Server readiness timeout: ${logs}`)),
        15000,
      );
      const finish = (error) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };
      child.once("error", finish);
      child.once("exit", (code) => finish(new Error(`Server exited (${code}): ${logs}`)));
      child.stdout.on("data", (data) => {
        logs += data.toString();
        if (readyPattern.test(logs)) finish();
      });
      child.stderr.on("data", (data) => {
        logs += data.toString();
      });
    });
    return { stop, logs };
  } catch (error) {
    await stop();
    throw error;
  }
}

export async function startFrontend(backendUrl) {
  const port = await freePort();
  const server = await startServer(
    "node",
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--config",
      "frontend/vite.config.ts",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
      "frontend",
    ],
    { BACKEND_URL: backendUrl, NO_COLOR: "1" },
    /Local:.*http:\/\/127\.0\.0\.1:/,
  );
  return { ...server, url: `http://127.0.0.1:${port}` };
}

export async function startBackend(databasePath) {
  const server = await startServer(
    "backend/target/debug/okoshko-backend",
    [],
    {
      BIND_ADDR: "127.0.0.1:0",
      DATABASE_PATH: databasePath,
    },
    /Окошко API: http:\/\/127\.0\.0\.1:\d+/,
  );
  // The backend chooses its own available port and reports it on stdout.
  return { ...server, url: server.logs.match(/http:\/\/127\.0\.0\.1:\d+/)[0] };
}
